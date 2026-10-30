import { reddit, redis, settings } from '@devvit/web/server';
import type { OnPostSubmitRequest } from '@devvit/web/shared';
import { getBotConfig } from '../config';
import { logger, logZSet } from '../helpers/log-helper';
import { formatSignature } from '../helpers/settings-helper';
import type { PostId } from '../types';
import { boundedThreshold, DEFAULT_WARNING, isNonresponder, qualifyingPosts } from './nonresponder-decision';

export const MODULE = {
  name: 'nonresponder-check',
  type: 'trigger',
  description: 'Warns authors who did not respond on their recent qualifying posts.',
  triggers: ['onPostSubmit'],
  redisKeys: ['bot:nrmod:handled:{postId}', 'bot:nrmod:log'],
  settings: ['nonresponderModEnabled', 'nonresponderPostsToCheck',
    'nonresponderMinComments', 'nonresponderIgnoreModerators',
    'nonresponderIgnoreContributors', 'nonresponderResponse', 'botSignature'],
} as const;
const log = logger(MODULE.name);

async function countResponses(postId: PostId, authorName: string): Promise<number> {
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
      if (comment.authorName.toLowerCase() === authorName.toLowerCase()
        && !comment.isRemoved() && !comment.spam
        && comment.body !== '[deleted]' && comment.body !== '[removed]') return 1;
      pending.push(comment.replies);
    }
    if (listing.hasMore) throw new Error('Incomplete comment listing');
  }
  return 0;
}

export async function run(event: OnPostSubmitRequest): Promise<void> {
  try {
    const enabled = (await settings.get<boolean>('nonresponderModEnabled')) ?? true;
    if (!enabled) return;
    const { post, author, subreddit } = event;
    if (!post?.id || !author?.name || !author.id || !subreddit?.name
      || author.name.toLowerCase() === '[deleted]') return;
    const config = getBotConfig();
    const bots = new Set([...config.botAuthors, config.botUsername, 'AutoModerator'].map(n => n.toLowerCase()));
    if (bots.has(author.name.toLowerCase())) return;

    const [ignoreMods, ignoreApproved, rawPosts, rawComments, warning, signature] = await Promise.all([
      settings.get<boolean>('nonresponderIgnoreModerators'),
      settings.get<boolean>('nonresponderIgnoreContributors'),
      settings.get<number>('nonresponderPostsToCheck'),
      settings.get<number>('nonresponderMinComments'),
      settings.get<string>('nonresponderResponse'),
      settings.get<string>('botSignature'),
    ]);
    const lookup = { subredditName: subreddit.name, username: author.name };
    if ((ignoreMods ?? true) && (await reddit.getModerators(lookup).all()).length) return;
    if ((ignoreApproved ?? true) && (await reddit.getApprovedUsers(lookup).all()).length) return;
    const postsToCheck = boundedThreshold(rawPosts ?? 2, 2, 10);
    const minComments = boundedThreshold(rawComments ?? 3, 3, 100);
    const current = await reddit.getPostById(post.id as PostId);
    if (current.isRemoved() || current.isSpam()) return;
    const history = await reddit.getPostsByUser({ username: author.name, sort: 'new', limit: 50, pageSize: 50 }).all();
    const previous = qualifyingPosts(history, post.id, subreddit.name, current.createdAt, postsToCheck, minComments);
    if (previous.length < postsToCheck) return;
    const responses: number[] = [];
    for (const previousPost of previous) {
      responses.push(await countResponses(previousPost.id, author.name));
      if (responses[responses.length - 1] > 0) return;
    }
    if (!isNonresponder(responses, postsToCheck)) return;
    const text = (warning ?? DEFAULT_WARNING).trim();
    if (!text) return;
    // Claim immediately before posting; retain the claim on ambiguous API failure
    // to avoid a retry duplicating a successfully submitted warning.
    const claimed = await redis.set(`bot:nrmod:handled:${post.id}`, '1', {
      nx: true, expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    if (!claimed) return;
    const reply = await current.addComment({ text: text + formatSignature(signature ?? ''), runAs: 'APP' });
    // Attempt both independently so distinguish failure never prevents locking.
    try { await reply.distinguish(true); }
    catch (err) { log.error('distinguish_failed', err, { postId: post.id, commentId: reply.id }); }
    await reply.lock();
    await logZSet('bot:nrmod:log', {
      postId: post.id, userId: author.id, commentId: reply.id, previousPostIds: previous.map(p => p.id),
    }, 200);
    log.info('warning_posted', { postId: post.id, commentId: reply.id, userId: author.id });
  } catch (err) {
    log.error('check_failed', err, { postId: event.post?.id });
  }
}
