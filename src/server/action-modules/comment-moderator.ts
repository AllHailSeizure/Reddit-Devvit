import type { Hono } from 'hono';
import { reddit, redis } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { logger } from '../logger';

const log = logger('comment-moderator');
const CHAIN_LOG_KEY = 'bot:chainmod:log';
const MAX_LOG_ENTRIES = 200;

type CommentId = `t1_${string}`;

async function collectSubtree(commentId: CommentId): Promise<CommentId[]> {
  const comment = await reddit.getCommentById(commentId);
  const ids: CommentId[] = [];
  const replies = await comment.replies.all();
  for (const reply of replies) {
    const childIds = await collectSubtree(reply.id as CommentId);
    ids.push(...childIds);
  }
  ids.push(commentId); // post-order: deepest children first
  return ids;
}

async function logAction(entry: object): Promise<void> {
  const ts = Date.now();
  await redis.zAdd(CHAIN_LOG_KEY, { score: ts, member: JSON.stringify({ ts, ...entry }) });
  await redis.zRemRangeByRank(CHAIN_LOG_KEY, 0, -(MAX_LOG_ENTRIES + 1));
}

async function removeChain(targetId: CommentId): Promise<string> {
  const mod = (await reddit.getCurrentUsername()) ?? 'unknown';
  log.info('Remove chain triggered', { targetId, by: mod });

  const ids = await collectSubtree(targetId);
  let removed = 0;

  for (const id of ids) {
    try {
      await reddit.remove(id, false);
      removed++;
    } catch (err) {
      log.warn('Failed to remove comment', { id, error: (err as Error).message });
    }
  }

  // Attach a removal note to the root so mods see the real initiator.
  try {
    await reddit.addRemovalNote({
      itemIds: [targetId],
      reasonId: 'other',
      modNote: `Chain removed by u/${mod} via llmphysics-bot (${removed} comment${removed !== 1 ? 's' : ''})`,
    });
  } catch (err) {
    log.warn('Could not add removal note', { error: (err as Error).message });
  }

  await logAction({ action: 'remove_chain', targetId, by: mod, count: removed });
  log.info('Chain removed', { targetId, count: removed, by: mod });
  return `Removed ${removed} comment${removed !== 1 ? 's' : ''}.`;
}

async function lockSubtree(commentId: CommentId): Promise<number> {
  let comment;
  try {
    comment = await reddit.getCommentById(commentId);
  } catch (err) {
    log.warn('Could not fetch comment, skipping', { id: commentId, error: (err as Error).message });
    return 0;
  }
  let count = 0;
  const replies = await comment.replies.all();
  for (const reply of replies) {
    count += await lockSubtree(reply.id as CommentId);
  }
  if (!comment.locked) {
    await comment.lock();
    count++;
  }
  return count;
}

async function lockChain(targetId: CommentId): Promise<string> {
  const mod = (await reddit.getCurrentUsername()) ?? 'unknown';
  log.info('Lock chain triggered', { targetId, by: mod });

  const locked = await lockSubtree(targetId);

  await logAction({ action: 'lock_chain', targetId, by: mod, count: locked });
  log.info('Chain locked', { targetId, count: locked, by: mod });
  return `Locked ${locked} comment${locked !== 1 ? 's' : ''}.`;
}

export function register(app: Hono): void {
  app.post('/internal/menu/remove-comment-chain', async (c) => {
    const { targetId } = await c.req.json<MenuItemRequest>();
    try {
      const message = await removeChain(targetId as CommentId);
      return c.json<UiResponse>({ showToast: { text: message, appearance: 'success' } });
    } catch (err) {
      log.error('removeChain failed', err);
      return c.json<UiResponse>({ showToast: { text: 'Failed to remove chain.', appearance: 'neutral' } });
    }
  });

  app.post('/internal/menu/lock-comment-chain', async (c) => {
    const { targetId } = await c.req.json<MenuItemRequest>();
    try {
      const message = await lockChain(targetId as CommentId);
      return c.json<UiResponse>({ showToast: { text: message, appearance: 'success' } });
    } catch (err) {
      log.error('lockChain failed', err);
      return c.json<UiResponse>({ showToast: { text: 'Failed to lock chain.', appearance: 'neutral' } });
    }
  });
}
