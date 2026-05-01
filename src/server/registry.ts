import type { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnAppUpgradeRequest,
  OnPostSubmitRequest,
  OnCommentCreateRequest,
  OnPostReportRequest,
  OnCommentReportRequest,
  OnModActionRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { logger } from './logger';
import type {
  AppInstallHandler,
  AppUpgradeHandler,
  PostSubmitHandler,
  CommentCreateHandler,
  PostReportHandler,
  CommentReportHandler,
  ModActionsHandler,
  ModuleHandler,
} from './types';

// ─── Trigger module imports ────────────────────────────────────────────────────
// Add one import line per new trigger module, e.g.:
// import { run as spamFilter } from './action-modules/spam-filter';
import { runOnComment, runOnPost } from './trigger-modules/command';
import { runOnCommentReport, runOnPostReport } from './trigger-modules/report-filter';

// ─── Command module imports ────────────────────────────────────────────────────
// Add one import line per new command module (side-effect: registers the command), e.g.:
// import './command-modules/score-command';
import './command-modules/define';

// ─── Menu module imports ───────────────────────────────────────────────────────
// Add one import line per new menu module, e.g.:
// import { register as registerMyModule } from './action-modules/my-module';
import { register as registerChainModerator } from './action-modules/chain-moderator';
import { run as runDepthCapModerator } from './trigger-modules/depth-cap-moderator';

// ─── Trigger arrays ────────────────────────────────────────────────────────────
// Add the imported run() to the appropriate array (one line per module).

const APP_INSTALL:    AppInstallHandler[]    = [];
const APP_UPGRADE:    AppUpgradeHandler[]    = [];
const POST_SUBMIT:    PostSubmitHandler[]    = [runOnPost];
const COMMENT_CREATE: CommentCreateHandler[] = [runOnComment, runDepthCapModerator];
const POST_REPORT:    PostReportHandler[]    = [runOnPostReport];
const COMMENT_REPORT: CommentReportHandler[] = [runOnCommentReport];
const MOD_ACTIONS:    ModActionsHandler[]    = [];

// ─── Dispatch ──────────────────────────────────────────────────────────────────

const log = logger('registry');

async function dispatch<T>(trigger: string, modules: ModuleHandler<T>[], event: T): Promise<void> {
  for (const mod of modules) {
    try {
      await mod(event);
    } catch (err) {
      log.error(`Module threw in ${trigger}`, err, { handler: mod.name });
    }
  }
}

// ─── registerAll ──────────────────────────────────────────────────────────────

export function registerAll(app: Hono): void {
  // Trigger routes
  app.post('/internal/triggers/app-install', async (c) => {
    await dispatch('app-install', APP_INSTALL, await c.req.json<OnAppInstallRequest>());
    return c.json<TriggerResponse>({ status: 'ok' });
  });

  app.post('/internal/triggers/app-upgrade', async (c) => {
    await dispatch('app-upgrade', APP_UPGRADE, await c.req.json<OnAppUpgradeRequest>());
    return c.json<TriggerResponse>({ status: 'ok' });
  });

  app.post('/internal/triggers/post-submit', async (c) => {
    await dispatch('post-submit', POST_SUBMIT, await c.req.json<OnPostSubmitRequest>());
    return c.json<TriggerResponse>({ status: 'ok' });
  });

  app.post('/internal/triggers/comment-create', async (c) => {
    await dispatch('comment-create', COMMENT_CREATE, await c.req.json<OnCommentCreateRequest>());
    return c.json<TriggerResponse>({ status: 'ok' });
  });

  app.post('/internal/triggers/post-report', async (c) => {
    await dispatch('post-report', POST_REPORT, await c.req.json<OnPostReportRequest>());
    return c.json<TriggerResponse>({ status: 'ok' });
  });

  app.post('/internal/triggers/comment-report', async (c) => {
    await dispatch('comment-report', COMMENT_REPORT, await c.req.json<OnCommentReportRequest>());
    return c.json<TriggerResponse>({ status: 'ok' });
  });

  app.post('/internal/triggers/mod-action', async (c) => {
    await dispatch('mod-action', MOD_ACTIONS, await c.req.json<OnModActionRequest>());
    return c.json<TriggerResponse>({ status: 'ok' });
  });

  // Menu modules — add one line per new menu module
  registerChainModerator(app);
}
