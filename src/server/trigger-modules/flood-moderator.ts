import { reddit, redis } from '@devvit/web/server';
import type { OnPostSubmitRequest, OnModActionRequest, OnPostDeleteRequest } from '@devvit/web/shared';
import { logger } from '../helpers/log-helper';
import { readSetting, formatSignature } from '../helpers/settings-helper';
import { evaluateFloodStatus, trackFloodPost, markPostModRemoved, markPostAutoRemoved, markPostDeleted } from '../helpers/redis-helper';
import type { PostId } from '../types';

const log = logger('flood-moderator');

export async function runQuotaCheck(event: OnPostSubmitRequest): Promise<void> {
  const post = event.post;
  const author = event.author;
  const subreddit = event.subreddit;

  if (!post?.id || !author?.name || !subreddit?.name) {
    log.warn('Missing post, author, or subreddit in event', {
      postId: post?.id,
      authorName: author?.name,
      subredditName: subreddit?.name,
    });
    return;
  }

  const postId = post.id as PostId;
  const authorName = author.name;
  const subredditName = subreddit.name;

  // Redis dedup to prevent double-processing
  const dedupeKey = `bot:flood:handled:${postId}`;
  const claimed = await redis.set(dedupeKey, '1', { nx: true });
  if (!claimed) {
    log.warn('Duplicate trigger (redis dedup key already exists)', { postId, dedupeKey });
    return;
  }
  try {
    await redis.expire(dedupeKey, 3600);
  } catch (err) {
    log.warn('Failed to set expiration on dedup key', { dedupeKey, error: (err as Error).message });
  }

  const [maxPosts, windowHours, ignoreModerators, ignoreContributors, ignoreAutoRemoved, ignoreRemoved, ignoreDeleted] = await Promise.all([
    readSetting('floodAssistantMaxPosts', 1),
    readSetting('floodAssistantWindowHours', 24),
    readSetting('floodAssistantIgnoreModerators', true),
    readSetting('floodAssistantIgnoreContributors', true),
    readSetting('floodAssistantIgnoreAutoRemoved', true),
    readSetting('floodAssistantIgnoreRemoved', true),
    readSetting('floodAssistantIgnoreDeleted', true),
  ]);

  log.info('Quota check started', { postId, authorName, subredditName, maxPosts, windowHours });

  let user;
  try {
    user = await reddit.getUserByUsername(authorName);
  } catch (err) {
    log.error('Failed to fetch user', err, { authorName });
    return;
  }

  if (!user) {
    log.warn('User not found', { authorName });
    return;
  }

  if (ignoreModerators) {
    try {
      const modPerms = await user.getModPermissionsForSubreddit(subredditName);
      if (modPerms.length > 0) {
        log.info('Post ignored (author is moderator)', { postId, authorName });
        return;
      }
    } catch (err) {
      log.warn('Could not check moderator status', { error: (err as Error).message, authorName });
    }
  }

  if (ignoreContributors) {
    try {
      const approved = await reddit.getApprovedUsers({ subredditName, username: authorName }).all();
      if (approved.length > 0) {
        log.info('Post ignored (author is approved contributor)', { postId, authorName });
        return;
      }
    } catch (err) {
      log.warn('Could not check approved contributor status', { error: (err as Error).message, authorName });
    }
  }

  // Evaluate quota BEFORE tracking so current post isn't counted against itself
  let status;
  try {
    status = await evaluateFloodStatus(user.id, user.username, maxPosts, windowHours, {
      ignoreDeleted,
      ignoreRemoved,
      ignoreAutoRemoved,
    }, postId);
  } catch (err) {
    log.error('Failed to evaluate flood status', err, { postId, authorName });
    return;
  }

  log.info('Quota evaluated', {
    postId,
    authorName,
    validPostCount: status.validPostCount,
    exceedsQuota: status.exceedsQuota,
  });

  // Track the post always — future checks need the history even if post is about to be removed
  try {
    const createdAt = post.createdAt ? new Date(post.createdAt) : new Date();
    await trackFloodPost(user.id, postId, createdAt);
  } catch (err) {
    log.error('Failed to track post in Redis', err, { postId, userId: user.id });
  }

  if (!status.exceedsQuota) {
    log.info('Post allowed (under quota)', { postId, authorName });
    return;
  }

  log.info('Quota exceeded, removing post', { postId, authorName, maxPosts, windowHours });

  // Re-fetch post to guard against double-removal
  let fullPost;
  try {
    fullPost = await reddit.getPostById(postId);
    if (fullPost.isRemoved() || fullPost.isSpam()) {
      log.info('Post already removed by something else, skipping enforcement', { postId });
      return;
    }
  } catch (err) {
    log.error('Failed to re-fetch post for removal check', err, { postId });
    return;
  }

  try {
    await reddit.remove(postId, false);
    log.info('Post removed', { postId, authorName });
  } catch (err) {
    log.error('Failed to remove post', err, { postId });
  }

  const responseText = await readSetting('floodAssistantResponse', '');
  if (responseText) {
    try {
      const rawSignature = await readSetting('botSignature', '');
      const notice = responseText + formatSignature(rawSignature);
      const reply = await fullPost.addComment({ text: notice });
      try {
        await reply.distinguish({ isSticky: true });
        log.info('Posted and distinguished removal comment', { postId, commentId: reply.id });
      } catch (err) {
        log.warn('Could not distinguish flood moderator comment', { postId, error: (err as Error).message });
      }
    } catch (err) {
      log.error('Failed to post removal comment', err, { postId });
    }
  }
}

export async function runOnModAction(event: OnModActionRequest): Promise<void> {
  if (event.action !== 'removelink' && event.action !== 'spamlink') {
    return;
  }

  const postId = event.targetPost?.id;
  if (!postId) {
    return;
  }

  try {
    // removedBy is available directly on the mod action event
    if (event.moderator?.name === 'llmphysics-bot') {
      await markPostAutoRemoved(postId);
      log.info('Tracked auto-removal by bot', { postId });
    } else {
      await markPostModRemoved(postId);
      log.info('Tracked removal by mod', { postId, mod: event.moderator?.name });
    }
  } catch (err) {
    log.error('Failed to track removal action', err, { postId, action: event.action });
  }
}

export async function runOnPostDelete(event: OnPostDeleteRequest): Promise<void> {
  // Only track user-initiated deletions (source === 1), not mod removals
  if (event.source !== 1) {
    return;
  }

  const postId = event.postId ?? event.post?.id;
  if (!postId) {
    return;
  }

  try {
    await markPostDeleted(postId);
    log.info('Tracked user deletion', { postId });
  } catch (err) {
    log.error('Failed to track deletion', err, { postId });
  }
}
