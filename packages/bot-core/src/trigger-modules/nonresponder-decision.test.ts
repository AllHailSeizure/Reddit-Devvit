import { describe, expect, it } from 'vitest';
import { boundedThreshold, isNonresponder, qualifyingPosts } from './nonresponder-decision';

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
