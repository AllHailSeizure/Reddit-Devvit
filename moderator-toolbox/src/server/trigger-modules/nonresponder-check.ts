import { reddit, redis, settings } from '@devvit/web/server';
import type { OnPostSubmitRequest } from '@devvit/web/shared';
import { logger, logZSet } from '../helpers/log-helper';
import { formatSignature } from '../helpers/settings-helper';
import type { PostId } from '../types';
import { boundedThreshold, countOtherUserComments, countResponses, DEFAULT_WARNING, isNonresponder, qualifyingPosts, shouldCheckPoster, shouldReportRepeat, wasWarned, type CommentRecord } from './nonresponder-decision';

export const MODULE = {
  name: 'nonresponder-check',
  type: 'trigger',
  description: 'Warns authors who did not respond on their recent qualifying posts.',
  triggers: ['onPostSubmit'],
  redisKeys: ['bot:nrmod:handled:{postId}', 'bot:nrmod:warned:{postId}', 'bot:nrmod:log'],
  settings: ['nonresponderModEnabled', 'nonresponderPostsToCheck',
    'nonresponderMinComments', 'nonresponderSkipLockedComments',
    'nonresponderRunOnMods', 'nonresponderRunOnApprovedUsers', 'nonresponderResponse', 'nonresponderReportRepeat', 'botSignature'],
} as const;
const log = logger(MODULE.name);

async function fetchComments(postId: PostId): Promise<CommentRecord[]> {
  const comments: CommentRecord[] = [];
  const pending = [reddit.getComments({ postId, sort: 'new', limit: 501, pageSize: 100 })];
  const seen = new Set<string>();
  let requests = 0;
  while (pending.length) {
    // Never infer absence from a truncated tree. Bound both nodes and listings.
    if (++requests > 50) throw new Error('Comment listing limit reached');
    const listing = pending.pop()!;
    for await (const comment of listing) {
      if (seen.has(comment.id)) continue;
      seen.add(comment.id);
      if (seen.size > 500) throw new Error('Comment scan limit reached');
      comments.push({
        id: comment.id, parentId: comment.parentId, authorName: comment.authorName,
        removed: comment.isRemoved() || comment.body === '[removed]',
        deleted: comment.body === '[deleted]' || comment.authorName.toLowerCase() === '[deleted]',
        locked: comment.locked, spam: comment.spam, body: comment.body, distinguished: !!comment.distinguishedBy,
      });
      pending.push(comment.replies);
    }
    if (listing.hasMore) throw new Error('Incomplete comment listing');
  }
  return comments;
}

export async function run(event: OnPostSubmitRequest): Promise<void> {
  try {
    const enabled = (await settings.get<boolean>('nonresponderModEnabled')) ?? true;
    if (!enabled) return;
    const { post, author, subreddit } = event;
    if (!post?.id || !author?.name || !author.id || !subreddit?.name
      || author.name.toLowerCase() === '[deleted]') return;
    const appUser = await reddit.getAppUser();
    if (!appUser?.username) return; // Cannot safely identify app comments without its account.
    const appAuthors = new Set([appUser.username.toLowerCase()]);
    if (appAuthors.has(author.name.toLowerCase())) return;

    const [skipLocked, runOnMods, runOnApprovedUsers, rawPosts, rawComments, warning, signature, reportRepeat] = await Promise.all([
      settings.get<boolean>('nonresponderSkipLockedComments'),
      settings.get<boolean>('nonresponderRunOnMods'),
      settings.get<boolean>('nonresponderRunOnApprovedUsers'),
      settings.get<number>('nonresponderPostsToCheck'),
      settings.get<number>('nonresponderMinComments'),
      settings.get<string>('nonresponderResponse'),
      settings.get<string>('botSignature'),
      settings.get<boolean>('nonresponderReportRepeat'),
    ]);
    const lookup = { subredditName: subreddit.name, username: author.name };
    // When both groups run, neither status can exempt the poster.
    const isMod = (!(runOnMods ?? false) || !(runOnApprovedUsers ?? true))
      && (await reddit.getModerators(lookup).all()).length > 0;
    const isApproved = !isMod && !(runOnApprovedUsers ?? true)
      && (await reddit.getApprovedUsers(lookup).all()).length > 0;
    if (!shouldCheckPoster({ isMod, isApproved,
      runOnMods: runOnMods ?? false, runOnApprovedUsers: runOnApprovedUsers ?? true })) return;
    const postsToCheck = boundedThreshold(rawPosts ?? 2, 2, 10);
    const minComments = boundedThreshold(rawComments ?? 3, 3, 100);
    const current = await reddit.getPostById(post.id as PostId);
    if (current.isRemoved() || current.isSpam()) return;
    const history = await reddit.getPostsByUser({ username: author.name, sort: 'new', limit: 50, pageSize: 50 }).all();
    const candidates = qualifyingPosts(history, post.id, subreddit.name, current.createdAt, 10, minComments);
    const previous: typeof candidates = [];
    const responses: number[] = [];
    const warned: boolean[] = [];
    const text = (warning ?? DEFAULT_WARNING).trim();
    if (!text) return;
    for (const candidate of candidates) {
      const comments = await fetchComments(candidate.id);
      if (countOtherUserComments(comments, author.name, appAuthors, skipLocked ?? true) < minComments) continue;
      previous.push(candidate);
      responses.push(countResponses(comments, author.name, appAuthors, skipLocked ?? true));
      if (responses[responses.length - 1] > 0) return;
      warned.push(wasWarned(comments, await redis.get(`bot:nrmod:warned:${candidate.id}`), text, appAuthors));
      if (previous.length === postsToCheck) break;
    }
    if (!isNonresponder(responses, postsToCheck)) return;
    const escalate = (reportRepeat ?? true) && shouldReportRepeat(warned, postsToCheck);
    // Claim immediately before posting; retain the claim on ambiguous API failure
    // to avoid a retry duplicating a successfully submitted warning.
    const claimed = await redis.set(`bot:nrmod:handled:${post.id}`, '1', {
      nx: true, expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    if (!claimed) return;
    const reply = await current.addComment({ text: text + formatSignature(signature ?? ''), runAs: 'APP' });
    try {
      await redis.set(`bot:nrmod:warned:${post.id}`, reply.id, {
        expiration: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      });
    } catch (err) { log.error('warning_tracking_failed', err, { postId: post.id }); }
    let reported = false;
    if (escalate) {
      try {
        await reddit.report(current, { reason: 'Nonresponder: repeated warnings ignored' });
        reported = true;
      } catch (err) { log.error('report_failed', err, { postId: post.id }); }
    }
    // Attempt both independently so distinguish failure never prevents locking.
    try { await reply.distinguish(true); }
    catch (err) { log.error('distinguish_failed', err, { postId: post.id, commentId: reply.id }); }
    try { await reply.lock(); }
    catch (err) { log.error('lock_failed', err, { postId: post.id, commentId: reply.id }); }
    await logZSet('bot:nrmod:log', {
      postId: post.id, userId: author.id, commentId: reply.id, previousPostIds: previous.map(p => p.id),
      escalationRequested: escalate, reported,
    }, 200);
    log.info('warning_posted', { postId: post.id, commentId: reply.id, userId: author.id });
  } catch (err) {
    log.error('check_failed', err, { postId: event.post?.id });
  }
}
