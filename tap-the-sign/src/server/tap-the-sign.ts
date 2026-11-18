import type { Hono } from 'hono';
import { media, reddit, redis, RichTextBuilder } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import signImageUrl from '../../assets/tap-the-sign.png?inline';
import { buildMathReply } from './latex-unicode';

type PostId = `t3_${string}`;
type CommentId = `t1_${string}`;

const tappedKey = (postId: PostId) => `tap-the-sign:tapped:${postId}`;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function register(app: Hono): void {
  app.post('/internal/menu/tap-the-sign', async (c) => {
    const { targetId } = await c.req.json<MenuItemRequest>();
    const postId = targetId as PostId;
    const key = tappedKey(postId);

    // Atomic once-per-post claim (no TTL — a post stays tapped for the install).
    // Released on failure so a failed comment can be retried.
    const claimed = await redis.set(key, '1', { nx: true });
    if (!claimed) {
      return c.json<UiResponse>({
        showToast: { text: 'Already tapped!', appearance: 'neutral' },
      });
    }

    try {
      const uploaded = await media.upload({
        url: signImageUrl,
        type: 'image',
      });

      const richtext = new RichTextBuilder().paragraph((p) => {
        p.image({ mediaUrl: uploaded.mediaUrl });
      });

      const meme = await reddit.submitComment({
        id: postId,
        richtext,
        runAs: 'APP',
      });

      // The meme is posted; nothing below may undo it or release the tap lock.
      await postMathReply(postId, meme.id as CommentId);

      return c.json<UiResponse>({
        showToast: { text: 'Tapped the sign.', appearance: 'success' },
      });
    } catch (err) {
      try {
        await redis.del(key);
      } catch (delErr) {
        console.error('[tap-the-sign] failed to clear tap lock after error', {
          postId,
          error: errorMessage(delErr),
        });
      }
      console.error('[tap-the-sign] failed to post comment', {
        postId,
        error: errorMessage(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return c.json<UiResponse>({
        showToast: {
          text: `Could not tap the sign: ${errorMessage(err)}`,
          appearance: 'neutral',
        },
      });
    }
  });
}

/**
 * Reply under the meme with the post's LaTeX converted to Unicode, then lock
 * (and distinguish) the reply. Never throws: a failure here is logged with a
 * reason and the meme stays up.
 */
async function postMathReply(postId: PostId, memeId: CommentId): Promise<void> {
  let stage = 'read_post';
  try {
    const post = await reddit.getPostById(postId);
    stage = 'convert';
    const reply = buildMathReply(post.body ?? '');
    if (!reply) {
      console.log('[tap-the-sign] math reply skipped', { postId, reason: 'no_nontrivial_math' });
      return;
    }
    stage = 'submit_reply';
    const comment = await reddit.submitComment({ id: memeId, text: reply.text, runAs: 'APP' });
    console.log('[tap-the-sign] math reply posted', {
      postId,
      memeId,
      replyId: comment.id,
      shown: reply.shown,
      omitted: reply.omitted,
      chars: reply.text.length,
    });
    // Lock and distinguish independently so one failing never skips the other.
    try {
      await comment.distinguish();
      console.log('[tap-the-sign] math reply distinguished', { replyId: comment.id });
    } catch (err) {
      console.warn('[tap-the-sign] math reply distinguish failed', {
        replyId: comment.id,
        reason: errorMessage(err),
      });
    }
    try {
      await comment.lock();
      console.log('[tap-the-sign] math reply locked', { replyId: comment.id });
    } catch (err) {
      console.error('[tap-the-sign] math reply lock failed', {
        replyId: comment.id,
        reason: errorMessage(err),
      });
    }
  } catch (err) {
    console.error('[tap-the-sign] math reply failed', {
      postId,
      memeId,
      stage,
      reason: errorMessage(err),
    });
  }
}
