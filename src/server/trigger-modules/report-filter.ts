import { reddit } from '@devvit/web/server';
import type { OnCommentReportRequest, OnPostReportRequest } from '@devvit/web/shared';
import { logger } from '../logger';
import type { CommentId, PostId } from '../types';

const log = logger('report-filter');

const BOT_AUTHORS = new Set(['AutoModerator', 'FloodAssistant', 'LLMPhysics-ModTeam', 'llmphysics-bot']);

export async function runOnCommentReport(event: OnCommentReportRequest): Promise<void> {
  const cv2 = event.comment;
  if (!cv2) return;
  if (!BOT_AUTHORS.has(cv2.author)) return;

  const comment = await reddit.getCommentById(cv2.id as CommentId);
  await comment.ignoreReports();
  log.info('Ignored bot comment report', { commentId: cv2.id, author: cv2.author, reason: event.reason });
}

export async function runOnPostReport(event: OnPostReportRequest): Promise<void> {
  const pv2 = event.post;
  if (!pv2) return;

  const post = await reddit.getPostById(pv2.id as PostId);
  if (!BOT_AUTHORS.has(post.authorName)) return;

  await post.ignoreReports();
  log.info('Ignored bot post report', { postId: pv2.id, author: post.authorName, reason: event.reason });
}
