import { reddit, redis } from '@devvit/web/server';
import type { OnCommentCreateRequest } from '@devvit/web/shared';
import { logger, logZSet } from '../helpers/log-helper';
import { readSetting, formatSignature } from '../helpers/settings-helper';
import type { CommentId } from '../types';

const log = logger('depth-cap-moderator');
const CAP_LOG_KEY = 'bot:chainmod:depth-log';
const CAP_LOG_MAX = 200;

export async function run(event: OnCommentCreateRequest): Promise<void> {
  const cv2 = event.comment;
  if (!cv2) return;

  const rawCap = await readSetting('depthCap', 10);
  const cap = Number(rawCap);
  if (isNaN(cap) || cap <= 0) return;

  const dedupeKey = `bot:dcmod:handled:${cv2.id}`;
  const claimed = await redis.set(dedupeKey, '1', { nx: true });
  if (!claimed) {
    log.warn('Duplicate trigger (redis dedup key already exists)', { commentId: cv2.id, dedupeKey });
    return;
  }
  try {
    await redis.expire(dedupeKey, 3600);
  } catch (err) {
    log.warn('Failed to set expiration on dedup key', { dedupeKey, expireSeconds: 3600, error: (err as Error).message });
  }
  log.info('Depth cap dedup claim succeeded', { commentId: cv2.id, dedupeKey });

  const rawSignature = await readSetting('botSignature', '');
  const depthCapResponse = await readSetting('depthCapResponse', '');
  const noticeBody = depthCapResponse || 'This comment has reached the maximum comment depth and locked.';
  const notice = (noticeBody || 'Depth cap reached.') + formatSignature(rawSignature);

  // Fast exit: direct reply to post is depth 1
  if (cv2.parentId.startsWith('t3_') && cap > 1) return;

  // Walk up cap-1 times to determine exact depth, collecting the ancestor chain
  const ancestors: Awaited<ReturnType<typeof reddit.getCommentById>>[] = [];
  const deepest = await reddit.getCommentById(cv2.id as CommentId);
  ancestors.push(deepest);

  let current = deepest;
  for (let i = 1; i < cap; i++) {
    if (!current.parentId.startsWith('t1_')) return; // depth < cap
    current = await reddit.getCommentById(current.parentId as CommentId);
    ancestors.push(current);
  }
  if (!current.parentId.startsWith('t3_')) return; // depth > cap

  // depth == cap — enforce
  log.info('Depth cap reached', { commentId: cv2.id, cap });

  // Reply before locking so the bot can post to an unlocked comment
  try {
    const reply = await deepest.reply({ text: notice });
    try { await reply.distinguish(); } catch (err) { log.warn('Could not distinguish depth cap notice', { error: (err as Error).message }); }
    try { await reply.lock(); } catch (err) { log.warn('Could not lock depth cap notice', { error: (err as Error).message }); }
  } catch (err) {
    log.warn('Could not leave depth cap notice', { error: (err as Error).message });
  }

  if (!deepest.locked) await deepest.lock();

  try {
    await deepest.report({ reason: 'Depth cap trigger' });
  } catch (err) {
    log.warn('Could not report depth cap trigger comment', { error: (err as Error).message });
  }

  await logZSet(CAP_LOG_KEY, { action: 'Depth cap trigger', commentId: cv2.id, cap }, CAP_LOG_MAX);
}
