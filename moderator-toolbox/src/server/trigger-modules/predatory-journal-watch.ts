import { reddit, redis, settings } from '@devvit/web/server';
import type { OnCommentCreateRequest, OnPostSubmitRequest } from '@devvit/web/shared';
import { logger, logZSet } from '../helpers/log-helper';
import { formatSignature } from '../helpers/settings-helper';
import type { CommentId, PostId } from '../types';
import {
  DEFAULT_WARNING,
  HANDLED_TTL_MS,
  WARNED_TTL_MS,
  extractDois,
  hitKeys,
  hostsFromText,
  resolveBearer,
  resolveDoiHeaders,
  isAppAuthor,
  renderWarning,
  warnedPublisherKey,
  type JournalHit,
} from './predatory-journal-decision';

export const MODULE = {
  name: 'predatory-journal-watch',
  type: 'trigger',
  description: 'Warns, without removing, when a post or comment links a watchlisted journal domain or DOI.',
  triggers: ['onPostSubmit', 'onCommentCreate'],
  redisKeys: [
    'bot:pjmod:handled:{contentId}',
    'bot:pjmod:pub:{postId}:{publisherKey}',
    'bot:pjmod:log',
  ],
  settings: [
    'predatoryWatchEnabled',
    'predatoryWatchCheckComments',
    'predatoryWatchWarning',
    'predatoryWatchAllowlist',
    'predatoryWatchMatchPublisherName',
    'botSignature',
    'supabaseUrl',
    'supabaseServiceKey',
    'supabaseFunctionToken',
  ],
} as const;

const log = logger(MODULE.name);
const LOG_KEY = 'bot:pjmod:log';

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

    const [warning, allowRaw, matchNames, signature] = await Promise.all([
      settings.get<string>('predatoryWatchWarning'),
      settings.get<string>('predatoryWatchAllowlist'),
      settings.get<boolean>('predatoryWatchMatchPublisherName'),
      settings.get<string>('botSignature'),
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

    const resolved = await resolveHits(directHosts, dois, allowRaw ?? null, matchNames ?? false);
    // Missing Supabase settings, or an empty watchlist, should retry on the next delivery.
    if (!resolved || resolved.watchlistCount === 0) return;
    const hits = resolved.hits;
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

interface ResolveResponse {
  hits: JournalHit[];
  watchlistCount: number;
}

async function resolveHits(
  hosts: string[],
  dois: string[],
  allowlist: string | null,
  matchPublisherName: boolean,
): Promise<ResolveResponse | null> {
  const [rawUrl, functionToken, serviceKey] = await Promise.all([
    settings.get<string>('supabaseUrl'),
    settings.get<string>('supabaseFunctionToken'),
    settings.get<string>('supabaseServiceKey'),
  ]);
  const supabaseUrl = (rawUrl || '').replace(/\/$/, '');
  const bearer = resolveBearer(functionToken, serviceKey);
  if (!supabaseUrl || !bearer) {
    log.warn('resolve_unconfigured', {
      reason: 'supabaseUrl, or both supabaseFunctionToken and supabaseServiceKey, are blank',
    });
    return null;
  }
  const res = await fetch(`${supabaseUrl}/functions/v1/resolve-doi`, {
    method: 'POST',
    headers: resolveDoiHeaders(bearer),
    body: JSON.stringify({ hosts, dois, allowlist, matchPublisherName }),
  });
  if (!res.ok) throw new Error(`resolve-doi HTTP ${res.status}`);
  const body = await res.json() as { hits?: unknown; watchlistCount?: unknown };
  const watchlistCount = typeof body.watchlistCount === 'number' ? body.watchlistCount : 0;
  if (watchlistCount === 0) {
    log.warn('watchlist_empty', { reason: 'resolve-doi returned no watchlist rows' });
  }
  return { hits: asHits(body.hits), watchlistCount };
}

function asHits(value: unknown): JournalHit[] {
  if (!Array.isArray(value)) return [];
  const hits: JournalHit[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const hit = row as Record<string, unknown>;
    if (typeof hit.publisherKey !== 'string' || typeof hit.domain !== 'string') continue;
    hits.push({
      publisherKey: hit.publisherKey,
      nameKey: typeof hit.nameKey === 'string' ? hit.nameKey : null,
      publisher: typeof hit.publisher === 'string' ? hit.publisher : hit.domain,
      sourceList: typeof hit.sourceList === 'string' ? hit.sourceList : '',
      sourceUrl: typeof hit.sourceUrl === 'string' ? hit.sourceUrl : '',
      domain: hit.domain,
    });
  }
  return hits;
}
