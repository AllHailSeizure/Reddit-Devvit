import type { Hono } from 'hono';
import { media, reddit, redis, RichTextBuilder } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import signImageUrl from '../../assets/tap-the-sign.png?inline';

type PostId = `t3_${string}`;

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

      await reddit.submitComment({
        id: postId,
        richtext,
        runAs: 'USER',
      });

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
