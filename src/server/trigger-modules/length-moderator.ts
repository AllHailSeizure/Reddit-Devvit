import { reddit, redis } from '@devvit/web/server';
import type { OnPostSubmitRequest } from '@devvit/web/shared';
import { logger } from '../helpers/log-helper';
import { readSetting, formatSignature } from '../helpers/settings-helper';
import type { PostId } from '../types';

const log = logger('length-moderator');

function bodyLength(text: string): number {
  return text.replace(/\s/g, '').length;
}

async function enforce(
  fullPost: Awaited<ReturnType<typeof reddit.getPostById>>,
  postId: PostId,
  commentText: string,
  signature: string,
  reason: string,
  logger: ReturnType<typeof logger>,
): Promise<void> {
  try {
    await reddit.remove(postId, false);
    logger.info(`${reason}: post removed`, { postId });
  } catch (err) {
    logger.error(`${reason}: failed to remove post`, err as Error, { postId });
  }
  try {
    await fullPost.lock();
    logger.info(`${reason}: post locked`, { postId });
  } catch (err) {
    logger.error(`${reason}: failed to lock post`, err as Error, { postId });
  }
  if (commentText) {
    try {
      const reply = await fullPost.addComment({ text: commentText + signature });
      await reply.distinguish({ isSticky: true });
      await reply.lock();
      logger.info(`${reason}: comment posted, distinguished, locked`, { postId });
    } catch (err) {
      logger.error(`${reason}: failed to post or distinguish comment`, err as Error, { postId });
    }
  }
}

export async function run(event: OnPostSubmitRequest): Promise<void> {
  const post = event.post;
  const author = event.author;
  const subreddit = event.subreddit;

  if (!post?.id || !author?.name || !subreddit?.name) {
    log.warn('Missing post, author, or subreddit in event', { postId: post?.id });
    return;
  }

  const postId = post.id as PostId;

  const dedupeKey = `bot:lenmod:handled:${postId}`;
  const claimed = await redis.set(dedupeKey, '1', { nx: true });
  if (!claimed) {
    log.warn('Duplicate trigger', { postId, dedupeKey });
    return;
  }
  try {
    await redis.expire(dedupeKey, 3600);
  } catch (err) {
    log.warn('Failed to set expiration on dedup key', { dedupeKey, error: (err as Error).message });
  }

  const flairId           = await readSetting('lengthModFlairId', '');
  const maxUnhostedLength = await readSetting('lengthModMaxUnhostedLength', 0);
  const minHostedLength   = await readSetting('lengthModMinHostedLength', 0);
  const unhostedComment   = await readSetting('lengthModMaxUnhostedComment', '');
  const hostedComment     = await readSetting('lengthModMinHostedComment', '');
  const rawSignature      = await readSetting('botSignature', '');
  const signature         = formatSignature(rawSignature);

  const postBody   = post.selfText ?? '';
  const charCount  = bodyLength(postBody);
  const isLinkPost = !!post.url;
  const flairMatch = flairId ? post.flair?.templateId === flairId : false;

  log.info('Length moderator triggered', { postId, charCount, isLinkPost, flairMatch });

  // Check 1: flair-gated max unhosted length
  if (flairMatch && maxUnhostedLength > 0 && charCount > maxUnhostedLength) {
    log.info('Post exceeds max unhosted length', { postId, charCount, maxUnhostedLength });
    const fullPost = await reddit.getPostById(postId);
    await enforce(fullPost, postId, unhostedComment, signature, 'max-unhosted', log);
    return;
  }

  // Check 2: link post min hosted length (no flair gate)
  if (isLinkPost && minHostedLength > 0 && charCount < minHostedLength) {
    log.info('Link post below min hosted length', { postId, charCount, minHostedLength });
    const fullPost = await reddit.getPostById(postId);
    await enforce(fullPost, postId, hostedComment, signature, 'min-hosted', log);
  }
}
