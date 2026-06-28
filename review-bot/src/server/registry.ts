import type { Hono } from 'hono';
import type { TriggerResponse } from '@devvit/web/shared';
import {
  initBotCore,
  runOnPostReport, runOnCommentReport,
  registerAdversarialReviewer, registerAdmin,
  logger,
} from '@llmphysics/bot-core';

// ─── Deployment identity ──────────────────────────────────────────────────────

initBotCore({
  botMention:   'u/Review-Bot',
  botUsername:  'review-bot',
  devSubreddit: 'llmphysics_dev',
  userAgent:    'review-bot/1.0 (Reddit bot; paper review)',
  botAuthors:   new Set(['AutoModerator', 'review-bot']),
});

// ─── Trigger arrays (report-moderator only: skips bot reports) ─────────────────

export const POST_REPORT    = [runOnPostReport];
export const COMMENT_REPORT = [runOnCommentReport];

// All other triggers empty or not exported
export const POST_SUBMIT    = [];
export const POST_FLAIR     = [];
export const COMMENT_CREATE = [];
export const MOD_ACTIONS    = [];
export const POST_DELETE    = [];

// ─── Dispatch loop ────────────────────────────────────────────────────────────

const log = logger('registry');

async function dispatch<T>(trigger: string, modules: Array<(e: T) => Promise<void>>, event: T): Promise<void> {
  for (const mod of modules) {
    try {
      await mod(event);
    } catch (err) {
      log.error(`Module threw in ${trigger}`, err, { handler: mod.name });
    }
  }
}

// ─── registerAll: mount only adversarial reviewer ─────────────────────────────

export function registerAll(app: Hono): void {
  // Trigger routes
  app.post('/internal/triggers/post-report',    async (c) => { await dispatch('post-report', POST_REPORT, await c.req.json()); return c.json<TriggerResponse>({ status: 'ok' }); });
  app.post('/internal/triggers/comment-report', async (c) => { await dispatch('comment-report', COMMENT_REPORT, await c.req.json()); return c.json<TriggerResponse>({ status: 'ok' }); });

  // Only the adversarial reviewer
  registerAdversarialReviewer(app);
  registerAdmin(app);
}
