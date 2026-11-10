import { reddit, redis, settings } from '@devvit/web/server';
import type { OnCommentCreateRequest, OnPostSubmitRequest } from '@devvit/web/shared';
import { logger, logZSet } from '../helpers/log-helper';
import { formatSignature } from '../helpers/settings-helper';
import type { CommentId, PostId } from '../types';
import {
  DEFAULT_ALLOWLIST,
  DEFAULT_CACHE_TTL_HOURS,
  DEFAULT_WARNING,
  DOI_CACHE_TTL_MS,
  HANDLED_TTL_MS,
  WARNED_TTL_MS,
  cacheTtlMs,
  doiCacheKey,
  extractDois,
  hitKeys,
  hostsFromCrossref,
  hostsFromDatacite,
  hostsFromText,
  isAppAuthor,
  matchPublication,
  mergeHits,
  parseAllowlist,
  registrationAgency,
  renderWarning,
  warnedPublisherKey,
  type JournalHit,
  type ResolvedPublication,
  type WatchEntry,
} from './predatory-journal-decision';

export const MODULE = {
  name: 'predatory-journal-watch',
  type: 'trigger',
  description: 'Warns, without removing, when a post or comment links a watchlisted journal domain or DOI.',
  triggers: ['onPostSubmit', 'onCommentCreate'],
  redisKeys: [
    'bot:pjmod:handled:{contentId}',
    'bot:pjmod:pub:{postId}:{publisherKey}',
    'bot:pjmod:watchlist',
    'bot:pjmod:doi:{doi}',
    'bot:pjmod:log',
  ],
  settings: [
    'predatoryWatchEnabled',
    'predatoryWatchCheckComments',
    'predatoryWatchWarning',
    'predatoryWatchAllowlist',
    'predatoryWatchMatchPublisherName',
    'predatoryWatchCrossrefMailto',
    'predatoryWatchCacheTtlHours',
    'botSignature',
    'supabaseUrl',
    'supabaseServiceKey',
  ],
} as const;

const log = logger(MODULE.name);
const WATCHLIST_KEY = 'bot:pjmod:watchlist';
const LOG_KEY = 'bot:pjmod:log';
const GENERIC_UA = 'moderator-toolbox/predatory-journal-watch (https://www.reddit.com/r/LLMPhysics)';

interface ScanTarget {
  kind: 'post' | 'comment';
  postId: string;
  contentId: string;
  commentId?: string;
  authorName?: string;
  userId?: string;
  text: string;
}

export async function runOnPost(event: OnPostSubmitRequest): Promise<void> {
  const post = event.post;
  if (!post?.id) return;
  await scan({
    kind: 'post',
    postId: post.id,
    contentId: post.id,
    authorName: event.author?.name,
    userId: event.author?.id,
    text: [post.selftext, post.url].filter(Boolean).join('\n'),
  });
}

export async function runOnComment(event: OnCommentCreateRequest): Promise<void> {
  const enabled = (await settings.get<boolean>('predatoryWatchEnabled')) ?? true;
  if (!enabled) return;
  const checkComments = (await settings.get<boolean>('predatoryWatchCheckComments')) ?? true;
  if (!checkComments) return;
  const comment = event.comment;
  const postId = event.post?.id || comment?.postId;
  if (!comment?.id || !postId) return;
  await scan({
    kind: 'comment',
    postId,
    contentId: comment.id,
    commentId: comment.id,
    authorName: event.author?.name || comment.author,
    userId: event.author?.id,
    text: comment.body ?? '',
  });
}

async function scan(target: ScanTarget): Promise<void> {
  try {
    const enabled = (await settings.get<boolean>('predatoryWatchEnabled')) ?? true;
    if (!enabled) return;
    if (await redis.get(`bot:pjmod:handled:${target.contentId}`)) return;
    if (!target.authorName || target.authorName.toLowerCase() === '[deleted]') return;

    const [warning, allowRaw, matchNames, mailto, signature, ttlHours] = await Promise.all([
      settings.get<string>('predatoryWatchWarning'),
      settings.get<string>('predatoryWatchAllowlist'),
      settings.get<boolean>('predatoryWatchMatchPublisherName'),
      settings.get<string>('predatoryWatchCrossrefMailto'),
      settings.get<string>('botSignature'),
      settings.get<number>('predatoryWatchCacheTtlHours'),
    ]);
    const template = warning ?? DEFAULT_WARNING;
    if (!template.trim()) return;

    const directHosts = hostsFromText(target.text);
    const dois = extractDois(target.text);
    if (directHosts.length === 0 && dois.length === 0) {
      await markHandled(target.contentId);
      return;
    }

    const appUser = await reddit.getAppUser();
    if (!appUser?.username) return;
    if (isAppAuthor(target.authorName, appUser.username)) {
      await markHandled(target.contentId);
      return;
    }

    const entries = await loadWatchlist(cacheTtlMs(ttlHours ?? DEFAULT_CACHE_TTL_HOURS));
    if (!entries) return;
    const allowlist = parseAllowlist(allowRaw ?? DEFAULT_ALLOWLIST);
    const resolved = await resolveDois(dois, (mailto ?? '').trim());
    const useNames = matchNames ?? false;
    let hits = matchPublication(directHosts, null, entries, allowlist, false);
    for (const publication of resolved) {
      hits = mergeHits([
        ...hits,
        ...matchPublication(publication.hosts, publication.publisher, entries, allowlist, useNames),
      ]);
    }
    if (hits.length === 0) {
      await markHandled(target.contentId);
      return;
    }

    const claimedHandle = await redis.set(`bot:pjmod:handled:${target.contentId}`, '1', {
      nx: true,
      expiration: new Date(Date.now() + HANDLED_TTL_MS),
    });
    if (!claimedHandle) {
      log.info('duplicate_trigger', { postId: target.postId, commentId: target.commentId });
      return;
    }

    const fresh = await claimPublishers(target.postId, hits);
    if (fresh.length === 0) return;
    const text = renderWarning(template, fresh) + formatSignature(signature ?? '');
    if (!text.trim()) {
      await releaseClaims(target.postId, target.contentId, fresh);
      return;
    }

    let posted = false;
    try {
      const replyId = await publish(target, text);
      posted = true;
      await logZSet(LOG_KEY, {
        postId: target.postId,
        commentId: replyId,
        userId: target.userId,
        kind: target.kind,
        publishers: fresh.map((hit) => hit.publisherKey),
      }, 200);
      log.info('warning_posted', {
        postId: target.postId,
        commentId: replyId,
        userId: target.userId,
        action: 'warned',
      });
    } catch (err) {
      if (!posted) await releaseClaims(target.postId, target.contentId, fresh);
      log.error('warning_post_failed', err, { postId: target.postId, commentId: target.commentId });
    }
  } catch (err) {
    log.error('check_failed', err, { postId: target.postId, commentId: target.commentId });
  }
}

async function publish(target: ScanTarget, text: string): Promise<string> {
  if (target.kind === 'post') {
    const post = await reddit.getPostById(target.postId as PostId);
    const reply = await post.addComment({ text, runAs: 'APP' });
    try {
      await reply.distinguish(true);
    } catch (err) {
      log.error('distinguish_failed', err, { postId: target.postId, commentId: reply.id });
    }
    try {
      await reply.lock();
    } catch (err) {
      log.error('lock_failed', err, { postId: target.postId, commentId: reply.id });
    }
    return reply.id;
  }
  const parent = await reddit.getCommentById(target.commentId as CommentId);
  const reply = await parent.reply({ text, runAs: 'APP' });
  try {
    await reply.distinguish(false);
  } catch (err) {
    log.error('distinguish_failed', err, { postId: target.postId, commentId: reply.id });
  }
  try {
    await reply.lock();
  } catch (err) {
    log.error('lock_failed', err, { postId: target.postId, commentId: reply.id });
  }
  return reply.id;
}

async function markHandled(contentId: string): Promise<void> {
  await redis.set(`bot:pjmod:handled:${contentId}`, '1', {
    nx: true,
    expiration: new Date(Date.now() + HANDLED_TTL_MS),
  });
}

async function claimPublishers(postId: string, hits: JournalHit[]): Promise<JournalHit[]> {
  const expiration = new Date(Date.now() + WARNED_TTL_MS);
  const claimed: JournalHit[] = [];
  for (const hit of hits) {
    // Claim the domain and the publisher-name key together. If either key already
    // exists, this publisher was warned on the post and this hit is not posted.
    let blocked = false;
    for (const key of hitKeys(hit)) {
      const ok = await redis.set(warnedPublisherKey(postId, key), '1', { nx: true, expiration });
      if (!ok) blocked = true;
    }
    if (!blocked) claimed.push(hit);
  }
  return claimed;
}

async function releaseClaims(postId: string, contentId: string, hits: JournalHit[]): Promise<void> {
  await redis.del(`bot:pjmod:handled:${contentId}`);
  for (const hit of hits) {
    for (const key of hitKeys(hit)) {
      await redis.del(warnedPublisherKey(postId, key));
    }
  }
}

async function loadWatchlist(ttlMs: number): Promise<WatchEntry[] | null> {
  try {
    const cached = await redis.get(WATCHLIST_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { entries?: WatchEntry[] };
      if (Array.isArray(parsed.entries)) return parsed.entries;
    }
  } catch (err) {
    log.warn('watchlist_cache_read_failed', { error: (err as Error).message });
  }

  const supabaseUrl = ((await settings.get<string>('supabaseUrl')) || '').replace(/\/$/, '');
  const supabaseKey = (await settings.get<string>('supabaseServiceKey')) || '';
  if (!supabaseUrl || !supabaseKey) {
    log.warn('watchlist_unconfigured', { reason: 'supabaseUrl or supabaseServiceKey is blank' });
    return null;
  }

  try {
    const entries = await fetchWatchlist(supabaseUrl, supabaseKey);
    // An empty table (sync not deployed yet) should be retried on the next event.
    if (entries.length > 0) {
      await redis.set(WATCHLIST_KEY, JSON.stringify({ entries }), { expiration: new Date(Date.now() + ttlMs) });
    }
    return entries;
  } catch (err) {
    log.error('watchlist_fetch_failed', err, {});
    return null;
  }
}

async function fetchWatchlist(supabaseUrl: string, supabaseKey: string): Promise<WatchEntry[]> {
  const entries: WatchEntry[] = [];
  const pageSize = 1000;
  let previousFirst = '';
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const url = `${supabaseUrl}/rest/v1/predatory_watchlist?active=eq.true&select=domain,name,source_list,source_url,list_type&order=domain.asc,source_list.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`watchlist HTTP ${res.status}`);
    const rows = await res.json() as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length === 0) break;
    const first = typeof rows[0]?.domain === 'string' ? rows[0].domain : '';
    if (first && first === previousFirst) break;
    previousFirst = first;
    for (const row of rows) {
      if (typeof row.domain !== 'string' || !row.domain) continue;
      entries.push({
        domain: row.domain,
        name: typeof row.name === 'string' ? row.name : '',
        sourceList: typeof row.source_list === 'string' ? row.source_list : '',
        sourceUrl: typeof row.source_url === 'string' ? row.source_url : '',
        listType: typeof row.list_type === 'string' ? row.list_type : '',
      });
    }
    if (rows.length < pageSize) break;
  }
  return entries;
}

async function resolveDois(dois: string[], mailto: string): Promise<ResolvedPublication[]> {
  const resolved: ResolvedPublication[] = [];
  for (const doi of dois) {
    const publication = await resolveDoi(doi, mailto);
    if (publication) resolved.push(publication);
  }
  return resolved;
}

async function resolveDoi(doi: string, mailto: string): Promise<ResolvedPublication | null> {
  const key = doiCacheKey(doi);
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as ResolvedPublication;
  } catch (err) {
    log.warn('doi_cache_read_failed', { error: (err as Error).message });
  }
  try {
    const publication = await lookupDoi(doi, mailto);
    await redis.set(key, JSON.stringify(publication), { expiration: new Date(Date.now() + DOI_CACHE_TTL_MS) });
    return publication;
  } catch (err) {
    log.warn('doi_lookup_failed', { error: (err as Error).message, reason: doi });
    return null;
  }
}

async function lookupDoi(doi: string, mailto: string): Promise<ResolvedPublication> {
  const userAgent = mailto ? `moderator-toolbox/predatory-journal-watch (mailto:${mailto})` : GENERIC_UA;
  const headers = { Accept: 'application/json', 'User-Agent': userAgent };
  const empty: ResolvedPublication = { hosts: [], publisher: null };
  const agencyRes = await fetch(`https://doi.org/doiRA/${encodeURIComponent(doi)}`, { headers });
  const agencyBody = await readDoiBody(agencyRes, 'doiRA');
  if (!agencyBody) return empty;
  const agency = registrationAgency(agencyBody);
  if (agency === 'crossref') {
    const query = mailto ? `?mailto=${encodeURIComponent(mailto)}` : '';
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}${query}`, { headers });
    const body = await readDoiBody(res, 'crossref');
    return body ? hostsFromCrossref(body) : empty;
  }
  if (agency === 'datacite') {
    const res = await fetch(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`, {
      headers: { ...headers, Accept: 'application/vnd.api+json' },
    });
    const body = await readDoiBody(res, 'datacite');
    return body ? hostsFromDatacite(body) : empty;
  }
  return empty;
}

/** 4xx is a cacheable miss. 5xx throws so the caller does not cache a transient failure. */
async function readDoiBody(res: Response, source: string): Promise<unknown | null> {
  if (res.status >= 500) throw new Error(`${source} HTTP ${res.status}`);
  if (!res.ok) return null;
  return res.json();
}
