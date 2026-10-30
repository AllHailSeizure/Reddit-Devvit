export interface PreviousPost {
  id: string;
  subredditName: string;
  createdAt: Date;
  numberOfComments: number;
  authorName: string;
  isRemoved(): boolean;
  isSpam(): boolean;
}

export function qualifyingPosts<T extends PreviousPost>(
  posts: T[], currentId: string, subreddit: string, submittedAt: Date,
  postsToCheck: number, minComments: number,
): T[] {
  // Reddit's total includes OP, bots, and removed comments. This inexpensive
  // eligibility gate avoids fetching trees for every post in the history.
  return posts.filter(p => p.id !== currentId
    && p.subredditName.toLowerCase() === subreddit.toLowerCase()
    && p.createdAt < submittedAt && !p.isRemoved() && !p.isSpam()
    && p.authorName !== '[deleted]' && p.numberOfComments >= minComments)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .filter((p, i, all) => all.findIndex(other => other.id === p.id) === i)
    .slice(0, postsToCheck);
}

export function isNonresponder(responseCounts: number[], postsToCheck: number): boolean {
  return responseCounts.length === postsToCheck && responseCounts.every(count => count === 0);
}

export function boundedThreshold(value: number, fallback: number, max: number): number {
  return Number.isInteger(value) && value >= 1 && value <= max ? value : fallback;
}

export const DEFAULT_WARNING = 'Responding to commenters is a subreddit rule. You did not respond on your recent qualifying posts. Please engage with the comments on this post by replying to commenters.';
