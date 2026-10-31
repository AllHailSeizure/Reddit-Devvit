import { describe, expect, it } from 'vitest';
import { boundedThreshold, countOtherUserComments, countResponses, isNonresponder, qualifyingPosts, shouldReportRepeat, wasWarned, type CommentRecord } from './nonresponder-decision';

const post = (id: string, day: number, extra = {}) => ({
  id, createdAt: new Date(2026, 0, day), subredditName: 'Example',
  numberOfComments: 3, authorName: 'alice', isRemoved: () => false,
  isSpam: () => false, ...extra,
});

describe('nonresponder decision', () => {
  it('selects the latest distinct eligible previous posts in this subreddit', () => {
    const posts = [post('old', 1), post('new', 10), post('recent', 9),
      post('recent', 9), post('other', 8, { subredditName: 'elsewhere' }),
      post('quiet', 7, { numberOfComments: 2 }), post('removed', 6, { isRemoved: () => true }),
      post('deleted', 5, { authorName: '[deleted]' }), post('spam', 4, { isSpam: () => true }),
      post('future', 11)];
    expect(qualifyingPosts(posts, 'new', 'example', new Date(2026, 0, 10), 2, 3)
      .map(p => p.id)).toEqual(['recent', 'old']);
  });
  it('requires enough qualifying posts and no surviving OP response on any', () => {
    expect(isNonresponder([], 2)).toBe(false);
    expect(isNonresponder([0], 2)).toBe(false);
    expect(isNonresponder([0, 0], 2)).toBe(true);
    expect(isNonresponder([0, 1], 2)).toBe(false);
    expect(isNonresponder([1, 0], 2)).toBe(false);
  });
  it('falls back for unsafe thresholds', () => {
    for (const value of [0, -1, 1.5, NaN, Infinity, 11]) {
      expect(boundedThreshold(value, 2, 10)).toBe(2);
    }
    expect(boundedThreshold(4, 2, 10)).toBe(4);
  });
});

const bots = new Set(['bot', 'automoderator', 'app']);
const comment = (id: string, authorName: string, parentId = 't3_post', extra = {}): CommentRecord => ({
  id, authorName, parentId, removed: false, deleted: false, spam: false,
  body: 'hello', distinguished: false, ...extra,
});

describe('comment tree decisions', () => {
  it('counts only surviving comments by other known humans, case insensitively', () => {
    const comments = [comment('1', 'Alice'), comment('2', 'BOT'), comment('3', 'AutoModerator'),
      comment('4', 'APP'), comment('5', 'bob', undefined, { removed: true }),
      comment('6', 'bob', undefined, { deleted: true }), comment('7', 'bob', undefined, { spam: true }),
      comment('8', '[deleted]'), comment('9', ''), comment('10', 'bob'), comment('11', 'carol')];
    expect(countOtherUserComments(comments, 'alice', bots)).toBe(2);
  });
  it.each([
    ['top-level', 't3_post', {}, 0], ['self reply', 't1_self', {}, 0],
    ['bot reply', 't1_bot', {}, 0], ['human reply', 't1_human', {}, 1],
    ['removed reply', 't1_human', { removed: true }, 0],
    ['deleted reply', 't1_human', { deleted: true }, 0],
    ['spam reply', 't1_human', { spam: true }, 0],
    ['unknown parent', 't1_missing', {}, 0], ['deleted author parent', 't1_deleted', {}, 0],
    ['removed parent', 't1_removed', {}, 1], ['deep reply', 't1_deep', {}, 1],
  ])('%s', (_label, parentId, extra, expected) => {
    const comments = [comment('t1_self', 'alice'), comment('t1_bot', 'BOT'),
      comment('t1_human', 'bob'), comment('t1_deleted', '[deleted]'),
      comment('t1_removed', 'bob', undefined, { removed: true, deleted: true }),
      comment('t1_deep', 'carol', 't1_human'), comment('t1_reply', 'ALICE', parentId, extra)];
    expect(countResponses(comments, 'alice', bots)).toBe(expected);
  });
  it('continues past candidates with insufficient human comments and bounds candidates', () => {
    const candidates = qualifyingPosts([post('old', 1), post('quiet', 8), post('recent', 9)],
      'new', 'Example', new Date(2026, 0, 10), 10, 3);
    const trees = { recent: [comment('1', 'bob'), comment('2', 'carol'), comment('3', 'dan')],
      quiet: [comment('1', 'bot')], old: [comment('1', 'bob'), comment('2', 'carol'), comment('3', 'dan')] };
    expect(candidates.filter(p => countOtherUserComments(trees[p.id as keyof typeof trees], 'alice', bots) >= 3)
      .slice(0, 2).map(p => p.id)).toEqual(['recent', 'old']);
    expect(qualifyingPosts(Array.from({ length: 15 }, (_, i) => post(String(i), i + 1)),
      'new', 'example', new Date(2026, 1, 1), 10, 3)).toHaveLength(10);
  });
  it('reports only when all required previous posts were warned', () => {
    expect(shouldReportRepeat([true, true], 2)).toBe(true);
    expect(shouldReportRepeat([true, false], 2)).toBe(false);
    expect(shouldReportRepeat([true], 2)).toBe(false);
    expect(shouldReportRepeat([], 2)).toBe(false);
  });
  it('recognizes tracking keys and distinguished warning prefixes only from app accounts', () => {
    expect(wasWarned([], 't1_saved', 'warning', new Set(['app']))).toBe(true);
    const warning = comment('t1_warning', 'APP', undefined, { body: 'warning signature', distinguished: true });
    expect(wasWarned([warning], undefined, 'warning', new Set(['app']))).toBe(true);
    expect(wasWarned([{ ...warning, distinguished: false }], undefined, 'warning', new Set(['app']))).toBe(false);
    expect(wasWarned([warning], undefined, 'changed', new Set(['app']))).toBe(false);
    expect(wasWarned([warning], undefined, 'warning', new Set(['bot']))).toBe(false);
    expect(wasWarned([warning], undefined, '', new Set(['app']))).toBe(false);
  });
});
