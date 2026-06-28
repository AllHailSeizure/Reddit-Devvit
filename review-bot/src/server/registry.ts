import type { Hono } from 'hono';
import {
  initBotCore,
  registerAdversarialReviewer, registerAdmin,
} from '@llmphysics/bot-core';

// ─── Deployment identity ──────────────────────────────────────────────────────

initBotCore({
  botMention:   'u/Review-Bot',
  botUsername:  'review-bot',
  devSubreddit: 'llmphysics_dev',
  userAgent:    'review-bot/1.0 (Reddit bot; paper review)',
  botAuthors:   new Set(['AutoModerator', 'review-bot']),
});

// ─── registerAll: mount ONLY adversarial reviewer + admin ──────────────────────

export function registerAll(app: Hono): void {
  registerAdversarialReviewer(app);
  registerAdmin(app);
}
