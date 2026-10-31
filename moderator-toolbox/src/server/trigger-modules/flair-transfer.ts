import type { Hono } from 'hono';
import { reddit, redis, settings } from '@devvit/web/server';
import type { OnPostFlairUpdateRequest } from '@devvit/web/shared';
import { logger } from '../helpers/log-helper';
import type { PostId } from '../types';

export const MODULE = {
  name: 'flair-transfer',
  type: 'trigger',
  description: 'Transfers a configured post flair milestone into a user flair award.',
  triggers: ['onPostFlairUpdate'],
  redisKeys: [
    'flair-transfer:post:{postId}',
    'flair-transfer:user:{userId}',
    'flair-transfer:retry-queue',
  ],
  settings: [
    'flairTransferEnabled',
    'flairTransferPostFlairTemplateId',
    'flairTransferUserFlairTemplateId',
    'flairTransferRequiredPostCount',
    'flairTransferOverwriteExistingUserFlair',
  ],
} as const;

const log = logger(MODULE.name);

const RETRY_QUEUE_KEY = 'flair-transfer:retry-queue';
const RETRY_DELAY_MS = 5 * 60 * 1000;

type ProgressRecord = {
  userId: string;
  username: string;
  subredditName: string;
  countedPosts: number;
  awarded: boolean;
  awardedFlairTemplateId: string;
  awardedAt: number | null;
  pendingAward: boolean;
  retryAttempts: number;
  lastAwardError: string;
  lastCountedPostId: string | null;
  lastCountedAt: number | null;
};

type FlairTransferConfig = {
  enabled: boolean;
  postFlairTemplateId: string;
  userFlairTemplateId: string;
  requiredPostCount: number;
  overwriteExistingUserFlair: boolean;
};

function postDedupeKey(postId: string): string {
  return `flair-transfer:post:${postId}`;
}

function userProgressKey(userId: string): string {
  return `flair-transfer:user:${userId}`;
}

function createDefaultProgress(userId: string, username: string, subredditName: string): ProgressRecord {
  return {
    userId,
    username,
    subredditName,
    countedPosts: 0,
    awarded: false,
    awardedFlairTemplateId: '',
    awardedAt: null,
    pendingAward: false,
    retryAttempts: 0,
    lastAwardError: '',
    lastCountedPostId: null,
    lastCountedAt: null,
  };
}

async function readConfig(): Promise<FlairTransferConfig> {
  const [
    enabled,
    postFlairTemplateId,
    userFlairTemplateId,
    requiredPostCount,
    overwriteExistingUserFlair,
  ] = await Promise.all([
    settings.get<boolean>('flairTransferEnabled').then((value) => value ?? true),
    settings.get<string>('flairTransferPostFlairTemplateId').then((value) => value ?? ''),
    settings.get<string>('flairTransferUserFlairTemplateId').then((value) => value ?? ''),
    settings.get<number>('flairTransferRequiredPostCount').then((value) => value ?? 0),
    settings.get<boolean>('flairTransferOverwriteExistingUserFlair').then((value) => value ?? false),
  ]);

  return {
    enabled,
    postFlairTemplateId,
    userFlairTemplateId,
    requiredPostCount,
    overwriteExistingUserFlair,
  };
}

async function loadProgress(userId: string, username: string, subredditName: string): Promise<ProgressRecord> {
  const raw = await redis.get(userProgressKey(userId));
  if (!raw) return createDefaultProgress(userId, username, subredditName);

  try {
    const parsed = JSON.parse(raw) as Partial<ProgressRecord>;
    return {
      ...createDefaultProgress(userId, username, subredditName),
      ...parsed,
      userId,
      username,
      subredditName,
    };
  } catch (err) {
    log.warn('progress_parse_failed', { userId, error: (err as Error).message });
    return createDefaultProgress(userId, username, subredditName);
  }
}

async function saveProgress(progress: ProgressRecord): Promise<void> {
  await redis.set(userProgressKey(progress.userId), JSON.stringify(progress));
}

async function scheduleRetry(progress: ProgressRecord, message: string): Promise<void> {
  progress.pendingAward = true;
  progress.retryAttempts += 1;
  progress.lastAwardError = message;
  await Promise.all([
    saveProgress(progress),
    redis.zAdd(RETRY_QUEUE_KEY, { score: Date.now() + RETRY_DELAY_MS, member: progress.userId }),
  ]);
}

async function unscheduleRetry(userId: string): Promise<void> {
  await redis.zRem(RETRY_QUEUE_KEY, [userId]);
}

async function isModerator(subredditName: string, username: string): Promise<boolean> {
  const moderators = await reddit.getModerators({ subredditName, username }).all();
  return moderators.length > 0;
}

function isAwardedForTarget(progress: ProgressRecord, targetFlairTemplateId: string): boolean {
  return progress.awarded && progress.awardedFlairTemplateId === targetFlairTemplateId;
}

async function applyUserFlair(
  progress: ProgressRecord,
  config: FlairTransferConfig,
  currentAuthorFlairTemplateId?: string,
  currentAuthorFlairText?: string,
): Promise<void> {
  if (progress.countedPosts < config.requiredPostCount) return;
  if (isAwardedForTarget(progress, config.userFlairTemplateId)) return;

  if (currentAuthorFlairTemplateId === config.userFlairTemplateId) {
    progress.awarded = true;
    progress.awardedFlairTemplateId = config.userFlairTemplateId;
    progress.awardedAt = Date.now();
    progress.pendingAward = false;
    progress.retryAttempts = 0;
    progress.lastAwardError = '';
    await Promise.all([saveProgress(progress), unscheduleRetry(progress.userId)]);
    log.info('award_already_present', {
      userId: progress.userId,
      username: progress.username,
      action: 'award_skipped',
      reason: 'already_present',
    });
    return;
  }

  if (!config.overwriteExistingUserFlair && currentAuthorFlairText && currentAuthorFlairText.trim()) {
    progress.pendingAward = false;
    progress.retryAttempts = 0;
    progress.lastAwardError = '';
    await Promise.all([saveProgress(progress), unscheduleRetry(progress.userId)]);
    log.info('award_skipped_existing_flair', {
      userId: progress.userId,
      username: progress.username,
      action: 'award_skipped',
      reason: 'existing_flair',
    });
    return;
  }

  try {
    await reddit.setUserFlair({
      subredditName: progress.subredditName,
      username: progress.username,
      flairTemplateId: config.userFlairTemplateId,
    });
    progress.awarded = true;
    progress.awardedFlairTemplateId = config.userFlairTemplateId;
    progress.awardedAt = Date.now();
    progress.pendingAward = false;
    progress.retryAttempts = 0;
    progress.lastAwardError = '';
    await Promise.all([saveProgress(progress), unscheduleRetry(progress.userId)]);
    log.info('award_applied', {
      userId: progress.userId,
      username: progress.username,
      action: 'award_applied',
      postCount: progress.countedPosts,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.warn('award_apply_failed', {
      userId: progress.userId,
      username: progress.username,
      action: 'award_retry_scheduled',
      error: errorMessage,
      retryAttempts: progress.retryAttempts + 1,
    });
    await scheduleRetry(progress, errorMessage);
  }
}

export async function run(event: OnPostFlairUpdateRequest): Promise<void> {
  const config = await readConfig();
  if (!config.enabled) return;
  if (!config.postFlairTemplateId || !config.userFlairTemplateId || config.requiredPostCount <= 0) {
    log.warn('configuration_incomplete', { action: 'skip' });
    return;
  }

  const post = event.post;
  if (!post?.id) {
    log.warn('event_missing_fields', {
      postId: post?.id,
    });
    return;
  }

  const newFlairTemplateId = post.linkFlair?.templateId ?? '';
  if (newFlairTemplateId !== config.postFlairTemplateId) return;

  const postId = post.id as PostId;

  let fullPost: Awaited<ReturnType<typeof reddit.getPostById>>;
  try {
    fullPost = await reddit.getPostById(postId);
  } catch (err) {
    log.warn('post_lookup_failed', { postId, error: (err as Error).message });
    return;
  }

  const authorId = fullPost.authorId;
  const authorName = fullPost.authorName;
  const subredditName = fullPost.subredditName;
  if (!authorId || !authorName || !subredditName) {
    log.warn('post_author_missing', {
      postId,
      userId: authorId,
      subredditName,
    });
    return;
  }

  let moderator = false;
  try {
    moderator = await isModerator(subredditName, authorName);
  } catch (err) {
    log.warn('moderator_check_failed', {
      userId: authorId,
      username: authorName,
      error: (err as Error).message,
    });
    return;
  }

  if (moderator) {
    log.info('moderator_exempt', {
      userId: authorId,
      username: authorName,
      action: 'skip',
      reason: 'moderator',
    });
    return;
  }

  const claimed = await redis.set(postDedupeKey(postId), '1', { nx: true });
  if (!claimed) {
    log.info('duplicate_post_ignored', { postId, action: 'dedupe_skip' });
    return;
  }

  const progress = await loadProgress(authorId, authorName, subredditName);
  progress.countedPosts += 1;
  progress.lastCountedPostId = postId;
  progress.lastCountedAt = Date.now();
  await saveProgress(progress);

  log.info('post_counted', {
    postId,
    userId: progress.userId,
    username: progress.username,
    countedPosts: progress.countedPosts,
    requiredPostCount: config.requiredPostCount,
    action: 'count_incremented',
  });

  await applyUserFlair(
    progress,
    config,
    fullPost.authorFlair?.templateId,
    fullPost.authorFlair?.text,
  );
}

export function register(app: Hono): void {
  app.post('/internal/scheduler/flair-transfer-retry', async (c) => {
    const config = await readConfig();
    if (!config.enabled) return c.json({ status: 'disabled' });
    if (!config.postFlairTemplateId || !config.userFlairTemplateId || config.requiredPostCount <= 0) {
      return c.json({ status: 'misconfigured' });
    }

    const now = Date.now();
    const due = await redis.zRange(RETRY_QUEUE_KEY, 0, now, { by: 'score' });
    const userIds = due.map((entry) => typeof entry === 'string' ? entry : entry.member);

    for (const userId of userIds) {
      const raw = await redis.get(userProgressKey(userId));
      if (!raw) {
        await unscheduleRetry(userId);
        continue;
      }

      let progress: ProgressRecord;
      try {
        progress = JSON.parse(raw) as ProgressRecord;
      } catch (err) {
        log.warn('retry_progress_parse_failed', { userId, error: (err as Error).message });
        await unscheduleRetry(userId);
        continue;
      }

      if (!progress.pendingAward || isAwardedForTarget(progress, config.userFlairTemplateId)) {
        progress.pendingAward = false;
        progress.retryAttempts = 0;
        progress.lastAwardError = '';
        await Promise.all([saveProgress(progress), unscheduleRetry(userId)]);
        continue;
      }

      try {
        const user = await reddit.getUserByUsername(progress.username);
        const currentFlair = await user.getUserFlairBySubreddit(progress.subredditName);
        await applyUserFlair(progress, config, undefined, currentFlair?.flairText);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log.warn('retry_processing_failed', {
          userId: progress.userId,
          username: progress.username,
          error: errorMessage,
          retryAttempts: progress.retryAttempts + 1,
        });
        await scheduleRetry(progress, errorMessage);
      }
    }

    return c.json({ status: 'ok', retriedUsers: userIds.length });
  });
}
