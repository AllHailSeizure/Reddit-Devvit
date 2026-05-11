import type { Hono } from 'hono';
import { redis, reddit } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { logger } from '../helpers/log-helper';
import type { PostId } from '../types';

const log = logger('bingo-game');

export interface BingoGame {
  bingoPostId: string;
  subredditName: string;
  calledWords: string[];
  createdAt: number;
  active: boolean;
}

export function gameKey(postId: string): string {
  return `bot:bingo:game:${postId}`;
}

export function sourceKey(bingoPostId: string): string {
  return `bot:bingo:source:${bingoPostId}`;
}

export function register(app: Hono): void {
  app.post('/internal/menu/bingo-start', async (c) => {
    const { targetId } = await c.req.json<MenuItemRequest>();

    const existing = await redis.get(gameKey(targetId));
    if (existing) {
      const game = JSON.parse(existing) as BingoGame;
      if (game.active) {
        return c.json<UiResponse>({
          showToast: { text: 'A bingo game is already active on this post.', appearance: 'neutral' },
        });
      }
    }

    let post;
    try {
      post = await reddit.getPostById(targetId as PostId);
    } catch (err) {
      log.error('Could not fetch source post', err, { targetId });
      return c.json<UiResponse>({
        showToast: { text: 'Could not start game — failed to fetch post.', appearance: 'neutral' },
      });
    }

    const { subredditName, title } = post;
    const shortTitle = title.length > 80 ? `${title.slice(0, 77)}...` : title;

    let bingoPost;
    try {
      bingoPost = await reddit.submitPost({
        subredditName,
        title: `LLMPhysics Bingo — ${shortTitle}`,
        text: [
          'A bingo game has been started!',
          '',
          `**Source post:** ${post.url}`,
          '',
          'To get your unique bingo card, comment:',
          '',
          '    u/LLMPhysics-bot !bingocard',
          '',
          'Each player gets a randomly shuffled 5×5 card filled with classic LLM clichés.',
          'First to get a line (row, column, or diagonal) wins!',
        ].join('\n'),
      });
    } catch (err) {
      log.error('Could not create bingo post', err, { sourcePostId: targetId });
      return c.json<UiResponse>({
        showToast: { text: 'Could not create bingo post. Try again.', appearance: 'neutral' },
      });
    }

    const game: BingoGame = {
      bingoPostId: bingoPost.id,
      subredditName,
      calledWords: [],
      createdAt: Date.now(),
      active: true,
    };
    await redis.set(gameKey(targetId), JSON.stringify(game));
    await redis.set(sourceKey(bingoPost.id), targetId);

    log.info('Bingo game started', { sourcePostId: targetId, bingoPostId: bingoPost.id });

    return c.json<UiResponse>({
      showToast: { text: 'Bingo game started! A new post has been created.', appearance: 'success' },
    });
  });
}
