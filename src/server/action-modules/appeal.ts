import type { Hono } from 'hono';
import { redis, reddit } from '@devvit/web/server';
import { logger, logZSet } from '../logger';
import type { PostId } from '../types';

const log = logger('appeal');
const APPEAL_LOG_KEY = 'bot:appeal:log';
const APPEAL_LOG_MAX = 200;
const APPEAL_TTL_SECONDS = 30 * 24 * 60 * 60;
export const APPEAL_INDEX_KEY = 'appeal:index';

type AppealState = 'pending' | 'removed' | 'review_requested';

export interface AppealRecord {
  authorName: string;
  postTitle: string;
  postUrl: string;
  subredditName: string;
  subredditId: string;
  startedAt: number;
  state: AppealState;
}

interface AppealToken {
  postId: string;
}

export function appealKey(postId: string): string {
  return `appeal:post:${postId}`;
}

function tokenKey(token: string): string {
  return `appeal:token:${token}`;
}

function makeToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// Called from saved-responses.ts when "lock and start appeal" is chosen.
// Locks the post, posts a distinguished comment with a UI link, and sends OP a modmail.
export async function startAppeal(targetId: string, baseUrl: string): Promise<void> {
  const post = await reddit.getPostById(targetId as PostId);
  const { subredditName, authorName } = post;

  await post.lock();

  const token = makeToken();
  const tokenData: AppealToken = { postId: targetId };

  await redis.set(tokenKey(token), JSON.stringify(tokenData));
  await redis.expire(tokenKey(token), APPEAL_TTL_SECONDS);

  const record: AppealRecord = {
    authorName,
    postTitle: post.title,
    postUrl: post.url,
    subredditName,
    subredditId: post.subredditId,
    startedAt: Date.now(),
    state: 'pending',
  };
  await redis.set(appealKey(targetId), JSON.stringify(record));
  await redis.expire(appealKey(targetId), APPEAL_TTL_SECONDS);
  await redis.zAdd(APPEAL_INDEX_KEY, { score: record.startedAt, member: targetId });

  const appealLink = `${baseUrl}/appeal/ui?token=${token}`;

  const comment = await reddit.submitComment({
    id: targetId as PostId,
    text: `Your post has been locked. If you are the post author, you can [manage your appeal here](${appealLink}).`,
  });
  try {
    await comment.distinguish();
  } catch {
    log.warn('Could not distinguish appeal comment', { id: comment.id });
  }

  await reddit.modMail.createConversation({
    subredditName,
    subject: 'Your post has been locked',
    body: `Your [post](${post.url}) has been locked.\n\nAs the post author, you can [manage your appeal here](${appealLink}).`,
    to: `u/${authorName}`,
  });

  await logZSet(APPEAL_LOG_KEY, { action: 'appeal_start', postId: targetId, authorName }, APPEAL_LOG_MAX);
  log.info('Appeal started', { postId: targetId, authorName });
}

// Handles the appeal web UI and action endpoints.
export function register(app: Hono): void {
  // GET /appeal/ui?token=... — renders the two-button appeal page
  app.get('/appeal/ui', async (c) => {
    const token = c.req.query('token') ?? '';
    if (!token) return c.html(page('Invalid link', 'This link is missing a token.'));

    const rawToken = await redis.get(tokenKey(token));
    if (!rawToken) return c.html(page('Link expired', 'This link has expired or has already been used.'));

    const { postId }: AppealToken = JSON.parse(rawToken);
    const rawRecord = await redis.get(appealKey(postId));
    if (!rawRecord) return c.html(page('Not found', 'No active appeal was found for this post.'));

    const record: AppealRecord = JSON.parse(rawRecord);

    if (record.state !== 'pending') {
      return c.html(page('Already resolved', 'This appeal has already been resolved.'));
    }

    return c.html(uiPage(token, record));
  });

  // POST /appeal/delete — bot-removes the post
  app.post('/appeal/delete', async (c) => {
    const body = await c.req.parseBody();
    const token = (body['token'] as string) ?? '';
    if (!token) return c.html(page('Invalid request', 'Missing token.'));

    const rawToken = await redis.get(tokenKey(token));
    if (!rawToken) return c.html(page('Link expired', 'This link has expired or has already been used.'));

    const { postId }: AppealToken = JSON.parse(rawToken);
    const rawRecord = await redis.get(appealKey(postId));
    if (!rawRecord) return c.html(page('Not found', 'No active appeal was found for this post.'));

    const record: AppealRecord = JSON.parse(rawRecord);

    if (record.state !== 'pending') {
      return c.html(page('Already resolved', 'This appeal has already been resolved.'));
    }

    try {
      await reddit.remove(postId as PostId, false);
    } catch (err) {
      log.warn('Delete: could not remove post', { postId, error: (err as Error).message });
      return c.html(page('Error', 'Failed to remove your post. Please contact the mods.'));
    }

    record.state = 'removed';
    await redis.set(appealKey(postId), JSON.stringify(record));
    await redis.del(tokenKey(token));
    await logZSet(APPEAL_LOG_KEY, { action: 'appeal_delete', postId, by: record.authorName }, APPEAL_LOG_MAX);
    log.info('Appeal: post removed', { postId, by: record.authorName });
    return c.html(page('Post removed', 'Your post has been removed.'));
  });

  // POST /appeal/review — reports the post to the mod queue as "Appeal Request"
  app.post('/appeal/review', async (c) => {
    const body = await c.req.parseBody();
    const token = (body['token'] as string) ?? '';
    if (!token) return c.html(page('Invalid request', 'Missing token.'));

    const rawToken = await redis.get(tokenKey(token));
    if (!rawToken) return c.html(page('Link expired', 'This link has expired or has already been used.'));

    const { postId }: AppealToken = JSON.parse(rawToken);
    const rawRecord = await redis.get(appealKey(postId));
    if (!rawRecord) return c.html(page('Not found', 'No active appeal was found for this post.'));

    const record: AppealRecord = JSON.parse(rawRecord);

    if (record.state !== 'pending') {
      return c.html(page('Already resolved', 'This appeal has already been resolved.'));
    }

    try {
      const post = await reddit.getPostById(postId as PostId);
      await reddit.report(post, { reason: 'Appeal Request' });
    } catch (err) {
      log.warn('Review: could not report post', { postId, error: (err as Error).message });
      return c.html(page('Error', 'Failed to notify mods. Please contact them directly.'));
    }

    record.state = 'review_requested';
    await redis.set(appealKey(postId), JSON.stringify(record));
    await redis.del(tokenKey(token));
    await logZSet(APPEAL_LOG_KEY, { action: 'appeal_review', postId, by: record.authorName }, APPEAL_LOG_MAX);
    log.info('Appeal: review requested', { postId, by: record.authorName });
    return c.html(page('Mods notified', 'Mods have been notified to review your changes. Thank you!'));
  });
}

function uiPage(token: string, record: AppealRecord): string {
  const t = escHtml(record.postTitle);
  const a = escHtml(record.authorName);
  const tk = escHtml(token);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Appeal Your Post</title><style>
body{font-family:sans-serif;max-width:480px;margin:4rem auto;padding:0 1rem;color:#1c1c1c}
h1{font-size:1.25rem}
.post-info{background:#f6f7f8;border-radius:6px;padding:.75rem 1rem;margin:1rem 0;font-size:.9rem}
.post-info strong{display:block;margin-bottom:.25rem}
.notice{color:#555;font-size:.85rem;margin:.5rem 0 1.5rem}
.btn{display:block;width:100%;padding:.75rem;border:none;border-radius:6px;font-size:1rem;cursor:pointer;margin-bottom:.75rem;text-align:center}
.btn-danger{background:#d93025;color:#fff}
.btn-primary{background:#0079d3;color:#fff}
</style></head><body>
<h1>Appeal Your Post</h1>
<div class="post-info"><strong>${t}</strong>by u/${a}</div>
<p class="notice">This page is for u/${a} only. Choose an option below:</p>
<form method="POST" action="/appeal/delete">
  <input type="hidden" name="token" value="${tk}">
  <button class="btn btn-danger" type="submit">Remove my post</button>
</form>
<form method="POST" action="/appeal/review">
  <input type="hidden" name="token" value="${tk}">
  <button class="btn btn-primary" type="submit">I&#39;ve made changes &#8212; notify mods</button>
</form>
</body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:sans-serif;max-width:480px;margin:4rem auto;padding:0 1rem;color:#1c1c1c}h1{font-size:1.25rem}</style></head><body><h1>${title}</h1><p>${body}</p></body></html>`;
}
