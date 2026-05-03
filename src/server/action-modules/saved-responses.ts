import type { Hono } from 'hono';
import { redis, reddit } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { logger, logZSet } from '../logger';
import type { CommentId, PostId } from '../types';

const log = logger('saved-responses');
const REDIS_KEY = 'bot:savedresponses';
const LOG_KEY = 'bot:savedresponses:log';
const LOG_MAX = 200;
const SESSION_TTL = 300;

type SavedResponse = { id: string; title: string; body: string };
type ApplySession = { targetId: string };
type EditSession = { responseId: string };

type FlairLike = {
  text?: string | undefined;
  richtext: { elementType?: string | undefined; text?: string | undefined }[];
};

type SelectFormValues = { responseId: string[] };
type ApplyFormValues = { message: string; lock: boolean };
type AddFormValues = { title: string; body: string };
type EditSelectFormValues = { responseId: string[] };
type EditApplyFormValues = { title: string; body: string };
type DeleteFormValues = { responseId: string[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadResponses(): Promise<SavedResponse[]> {
  const raw = await redis.get(REDIS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedResponse[];
  } catch {
    return [];
  }
}

async function saveResponses(responses: SavedResponse[]): Promise<void> {
  await redis.set(REDIS_KEY, JSON.stringify(responses));
}

function sortedOptions(responses: SavedResponse[]): { label: string; value: string }[] {
  return [...responses]
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
    .map((r) => ({ label: r.title, value: r.id }));
}

async function getApplySession(username: string): Promise<ApplySession | null> {
  const raw = await redis.get(`bot:savedresponses:apply:${username}`);
  return raw ? (JSON.parse(raw) as ApplySession) : null;
}

async function setApplySession(username: string, data: ApplySession): Promise<void> {
  const key = `bot:savedresponses:apply:${username}`;
  await redis.set(key, JSON.stringify(data));
  await redis.expire(key, SESSION_TTL);
}

async function getEditSession(username: string): Promise<EditSession | null> {
  const raw = await redis.get(`bot:savedresponses:edit:${username}`);
  return raw ? (JSON.parse(raw) as EditSession) : null;
}

async function setEditSession(username: string, data: EditSession): Promise<void> {
  const key = `bot:savedresponses:edit:${username}`;
  await redis.set(key, JSON.stringify(data));
  await redis.expire(key, SESSION_TTL);
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Extracts only text elements from richtext flair, stripping emojis.
function extractFlairText(flair: FlairLike | undefined): string {
  if (!flair) return '';
  if (flair.richtext.length > 0) {
    const parts = flair.richtext
      .filter((el) => el.elementType === 'text' && el.text)
      .map((el) => el.text!);
    if (parts.length > 0) return parts.join('').trim();
  }
  // Fallback: strip Extended_Pictographic from plain text
  return (flair.text ?? '').replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();
}

// Expands {get_username}, {get_post_flair}, {modmail} in a message body.
async function expandMacros(text: string, targetId: string): Promise<string> {
  const needsUsername = text.includes('{get_username}');
  const needsFlair = text.includes('{get_post_flair}');
  const needsModmail = text.includes('{modmail}');
  if (!needsUsername && !needsFlair && !needsModmail) return text;

  let authorName = '';
  let subredditName = '';
  let postFlair = '';

  if (targetId.startsWith('t1_')) {
    const comment = await reddit.getCommentById(targetId as CommentId);
    if (needsUsername) authorName = comment.authorName;
    if (needsModmail || needsFlair) subredditName = comment.subredditName;
    if (needsFlair) {
      const post = await reddit.getPostById(comment.postId as PostId);
      postFlair = extractFlairText(post.flair);
    }
  } else {
    const post = await reddit.getPostById(targetId as PostId);
    if (needsUsername) authorName = post.authorName;
    if (needsModmail || needsFlair) subredditName = post.subredditName;
    if (needsFlair) postFlair = extractFlairText(post.flair);
  }

  return text
    .replace(/\{get_username\}/g, `u/${authorName}`)
    .replace(/\{get_post_flair\}/g, postFlair)
    .replace(
      /\{modmail\}/g,
      subredditName
        ? `[modmail](https://www.reddit.com/message/compose?to=/r/${subredditName})`
        : ''
    );
}

// ─── Module ───────────────────────────────────────────────────────────────────

export function register(app: Hono): void {
  // ─── Apply flow ───────────────────────────────────────────────────────────

  app.post('/internal/menu/apply-saved-response', async (c) => {
    const { targetId } = await c.req.json<MenuItemRequest>();
    const responses = await loadResponses();

    if (responses.length === 0) {
      return c.json<UiResponse>({
        showToast: 'No saved responses yet. Add some from the subreddit menu.',
      });
    }

    const mod = (await reddit.getCurrentUsername()) ?? 'unknown';
    await setApplySession(mod, { targetId });

    return c.json<UiResponse>({
      showForm: {
        name: 'saved-response-select',
        form: {
          title: 'Apply saved response',
          description: "Select a response. You'll be able to edit it before sending.",
          acceptLabel: 'Next',
          fields: [
            {
              type: 'select',
              name: 'responseId',
              label: 'Response',
              options: sortedOptions(responses),
              required: true,
            },
          ],
        },
      },
    });
  });

  app.post('/internal/forms/saved-response/step2', async (c) => {
    const values = await c.req.json<SelectFormValues>();
    const responseId = values.responseId[0];
    const mod = (await reddit.getCurrentUsername()) ?? 'unknown';

    const session = await getApplySession(mod);
    if (!session) {
      return c.json<UiResponse>({ showToast: 'Session expired. Please try again.' });
    }

    const responses = await loadResponses();
    const response = responses.find((r) => r.id === responseId);
    if (!response) {
      return c.json<UiResponse>({ showToast: 'Response not found.' });
    }

    return c.json<UiResponse>({
      showForm: {
        name: 'saved-response-apply',
        form: {
          title: `Apply: ${response.title}`,
          acceptLabel: 'Submit',
          fields: [
            {
              type: 'paragraph',
              name: 'message',
              label: 'Message to user',
              defaultValue: response.body,
              required: true,
            },
            {
              type: 'boolean',
              name: 'lock',
              label: 'Lock thread',
              defaultValue: false,
            },
          ],
        },
      },
    });
  });

  app.post('/internal/forms/saved-response/apply', async (c) => {
    const { message, lock } = await c.req.json<ApplyFormValues>();
    const mod = (await reddit.getCurrentUsername()) ?? 'unknown';

    const session = await getApplySession(mod);
    if (!session) {
      return c.json<UiResponse>({ showToast: 'Session expired. Please try again.' });
    }

    const { targetId } = session;
    await redis.del(`bot:savedresponses:apply:${mod}`);

    try {
      const expanded = await expandMacros(message, targetId);

      const reply = await reddit.submitComment({
        id: targetId as CommentId | PostId,
        text: expanded,
      });
      try {
        await reply.distinguish();
      } catch {
        log.warn('Could not distinguish comment', { id: reply.id });
      }

      if (lock) {
        try {
          if (targetId.startsWith('t1_')) {
            const comment = await reddit.getCommentById(targetId as CommentId);
            await comment.lock();
          } else {
            const post = await reddit.getPostById(targetId as PostId);
            await post.lock();
          }
        } catch {
          log.warn('Could not lock target', { targetId });
        }
      }

      await logZSet(LOG_KEY, { action: 'apply', targetId, lock, by: mod }, LOG_MAX);

      return c.json<UiResponse>({
        showToast: {
          text: lock ? 'Response posted and thread locked.' : 'Response posted.',
          appearance: 'success',
        },
      });
    } catch (err) {
      log.error('Failed to apply saved response', err);
      return c.json<UiResponse>({ showToast: 'Failed to send response.' });
    }
  });

  // ─── Add flow ─────────────────────────────────────────────────────────────

  app.post('/internal/menu/add-saved-response', async (c) => {
    return c.json<UiResponse>({
      showForm: {
        name: 'saved-response-add',
        form: {
          title: 'Add saved response',
          acceptLabel: 'Save',
          fields: [
            { type: 'string', name: 'title', label: 'Name', required: true },
            { type: 'paragraph', name: 'body', label: 'Message', required: true },
          ],
        },
      },
    });
  });

  app.post('/internal/forms/saved-response/add', async (c) => {
    const { title, body } = await c.req.json<AddFormValues>();
    const responses = await loadResponses();
    responses.push({ id: makeId(), title: title.trim(), body: body.trim() });
    await saveResponses(responses);
    log.info('Saved response added', { title });
    return c.json<UiResponse>({
      showToast: { text: `Saved response "${title}" added.`, appearance: 'success' },
    });
  });

  // ─── Edit flow ────────────────────────────────────────────────────────────

  app.post('/internal/menu/edit-saved-response', async (c) => {
    const responses = await loadResponses();
    if (responses.length === 0) {
      return c.json<UiResponse>({ showToast: 'No saved responses to edit.' });
    }
    return c.json<UiResponse>({
      showForm: {
        name: 'saved-response-edit-select',
        form: {
          title: 'Edit saved response',
          description: 'Select a response to edit.',
          acceptLabel: 'Next',
          fields: [
            {
              type: 'select',
              name: 'responseId',
              label: 'Response',
              options: sortedOptions(responses),
              required: true,
            },
          ],
        },
      },
    });
  });

  app.post('/internal/forms/saved-response/edit-select', async (c) => {
    const values = await c.req.json<EditSelectFormValues>();
    const responseId = values.responseId[0];
    const responses = await loadResponses();
    const response = responses.find((r) => r.id === responseId);

    if (!response) {
      return c.json<UiResponse>({ showToast: 'Response not found.' });
    }

    const mod = (await reddit.getCurrentUsername()) ?? 'unknown';
    await setEditSession(mod, { responseId });

    return c.json<UiResponse>({
      showForm: {
        name: 'saved-response-edit-apply',
        form: {
          title: 'Edit saved response',
          acceptLabel: 'Save',
          fields: [
            {
              type: 'string',
              name: 'title',
              label: 'Name',
              defaultValue: response.title,
              required: true,
            },
            {
              type: 'paragraph',
              name: 'body',
              label: 'Message',
              defaultValue: response.body,
              required: true,
            },
          ],
        },
      },
    });
  });

  app.post('/internal/forms/saved-response/edit-apply', async (c) => {
    const { title, body } = await c.req.json<EditApplyFormValues>();
    const mod = (await reddit.getCurrentUsername()) ?? 'unknown';

    const session = await getEditSession(mod);
    if (!session) {
      return c.json<UiResponse>({ showToast: 'Session expired. Please try again.' });
    }

    const responses = await loadResponses();
    const idx = responses.findIndex((r) => r.id === session.responseId);
    if (idx === -1) {
      return c.json<UiResponse>({ showToast: 'Response not found.' });
    }

    responses[idx] = { id: session.responseId, title: title.trim(), body: body.trim() };
    await saveResponses(responses);
    await redis.del(`bot:savedresponses:edit:${mod}`);

    log.info('Saved response updated', { id: session.responseId, title });
    return c.json<UiResponse>({
      showToast: { text: `Response "${title}" updated.`, appearance: 'success' },
    });
  });

  // ─── Delete flow ──────────────────────────────────────────────────────────

  app.post('/internal/menu/delete-saved-response', async (c) => {
    const responses = await loadResponses();
    if (responses.length === 0) {
      return c.json<UiResponse>({ showToast: 'No saved responses to delete.' });
    }
    return c.json<UiResponse>({
      showForm: {
        name: 'saved-response-delete',
        form: {
          title: 'Delete saved response',
          description: 'Select a response to permanently delete.',
          acceptLabel: 'Delete',
          fields: [
            {
              type: 'select',
              name: 'responseId',
              label: 'Response',
              options: sortedOptions(responses),
              required: true,
            },
          ],
        },
      },
    });
  });

  app.post('/internal/forms/saved-response/delete', async (c) => {
    const values = await c.req.json<DeleteFormValues>();
    const responseId = values.responseId[0];
    const responses = await loadResponses();
    const idx = responses.findIndex((r) => r.id === responseId);
    if (idx === -1) {
      return c.json<UiResponse>({ showToast: 'Response not found.' });
    }
    const [deleted] = responses.splice(idx, 1);
    await saveResponses(responses);
    log.info('Saved response deleted', { id: responseId, title: deleted.title });
    return c.json<UiResponse>({
      showToast: { text: `Response "${deleted.title}" deleted.`, appearance: 'success' },
    });
  });
}
