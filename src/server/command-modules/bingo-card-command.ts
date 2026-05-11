import { redis, reddit } from '@devvit/web/server';
import { logger } from '../helpers/log-helper';
import { registerCommand } from '../helpers/command-helper';
import type { CommandEvent, CommentId } from '../types';
import { BINGO_WORDS } from '../bingo-words-list';
import { sourceKey } from '../action-modules/bingo-game';

const log = logger('bingo-card');

interface BingoCard {
  grid: string[][];
}

function cardKey(bingoPostId: string, username: string): string {
  return `bot:bingo:card:${bingoPostId}:${username}`;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function generateGrid(): string[][] {
  const words = shuffle(BINGO_WORDS).slice(0, 24);
  const grid: string[][] = [];
  for (let r = 0; r < 5; r++) {
    grid.push(words.slice(r * 5, r * 5 + 5));
  }
  grid[2]![2] = 'FREE';
  return grid;
}

function formatCard(grid: string[][]): string {
  const header = '| B | I | N | G | O |';
  const sep = '|---|---|---|---|---|';
  const rows = grid.map(row => `| ${row.join(' | ')} |`);
  return [header, sep, ...rows].join('\n');
}

// Exported for use by the future trigger module when calling words.
export function checkBingo(grid: string[][], calledWords: Set<string>): boolean {
  const hit = (r: number, c: number): boolean =>
    grid[r]![c] === 'FREE' || calledWords.has(grid[r]![c]!);

  for (let i = 0; i < 5; i++) {
    if ([0, 1, 2, 3, 4].every(j => hit(i, j))) return true; // row i
    if ([0, 1, 2, 3, 4].every(j => hit(j, i))) return true; // col i
  }
  if ([0, 1, 2, 3, 4].every(i => hit(i, i))) return true;    // \ diagonal
  if ([0, 1, 2, 3, 4].every(i => hit(i, 4 - i))) return true; // / diagonal
  return false;
}

registerCommand(
  { commandName: 'bingocard', contentType: 'comment', requiresArgument: false },
  async (event: CommandEvent) => {
    if (!('comment' in event) || !event.comment || !event.post) return;

    const postId = event.post.id;
    const sourcePostId = await redis.get(sourceKey(postId));
    if (!sourcePostId) return; // not a bingo post, silently ignore

    const username = event.author?.name;
    if (!username) return;

    const commentId = event.comment.id as CommentId;
    const key = cardKey(postId, username);
    const existing = await redis.get(key);

    const comment = await reddit.getCommentById(commentId);

    if (existing) {
      const card = JSON.parse(existing) as BingoCard;
      await comment.reply({
        text: [
          `You already have a bingo card on this game, ${username}! Here it is again:`,
          '',
          formatCard(card.grid),
        ].join('\n'),
      });
      return;
    }

    const grid = generateGrid();
    const cardText = [
      `**${username}'s Bingo Card**`,
      '',
      formatCard(grid),
      '',
      '*Words will be called as the source post discussion unfolds. First to get a line wins!*',
    ].join('\n');

    try {
      await comment.reply({ text: cardText });
    } catch (err) {
      log.error('Could not post bingo card', err, { username, postId });
      return;
    }

    await redis.set(key, JSON.stringify({ grid } satisfies BingoCard));
    log.info('Bingo card generated', { username, postId });
  },
);
