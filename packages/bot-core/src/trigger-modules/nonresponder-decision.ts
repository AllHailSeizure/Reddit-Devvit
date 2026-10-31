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
  candidateLimit: number, minComments: number,
): T[] {
  // Cheap candidate pre-filter only; qualify using the complete comment tree.
  return posts.filter(p => p.id !== currentId
    && p.subredditName.toLowerCase() === subreddit.toLowerCase()
    && p.createdAt < submittedAt && !p.isRemoved() && !p.isSpam()
    && p.authorName !== '[deleted]' && p.numberOfComments >= minComments)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .filter((p, i, all) => all.findIndex(other => other.id === p.id) === i)
    .slice(0, candidateLimit);
}

export function isNonresponder(responseCounts: number[], postsToCheck: number): boolean {
  return responseCounts.length === postsToCheck && responseCounts.every(count => count === 0);
}

export function boundedThreshold(value: number, fallback: number, max: number): number {
  return Number.isInteger(value) && value >= 1 && value <= max ? value : fallback;
}

export const DEFAULT_WARNING = 'Responding to commenters is a subreddit rule. You did not respond on your recent qualifying posts. Please engage with the comments on this post by replying to commenters.';

export interface CommentRecord {
  id: string;
  parentId: string;
  authorName: string;
  removed: boolean;
  deleted: boolean;
  spam: boolean;
  body: string;
  distinguished: boolean;
}

function knownHuman(name: string, op: string, bots: ReadonlySet<string>): boolean {
  const normalized = name.toLowerCase();
  return !!normalized && normalized !== '[deleted]' && normalized !== '[removed]'
    && normalized !== op.toLowerCase() && !bots.has(normalized);
}

export function countOtherUserComments(comments: CommentRecord[], op: string, bots: ReadonlySet<string>): number {
  return comments.filter(c => knownHuman(c.authorName, op, bots)
    && !c.removed && !c.deleted && !c.spam).length;
}

export function countResponses(comments: CommentRecord[], op: string, bots: ReadonlySet<string>): number {
  const byId = new Map(comments.map(c => [c.id, c]));
  return comments.filter(c => {
    if (c.authorName.toLowerCase() !== op.toLowerCase() || c.removed || c.deleted || c.spam
      || !c.parentId.startsWith('t1_')) return false;
    const parent = byId.get(c.parentId);
    // A since-removed parent still establishes engagement if its author is known.
    return !!parent && knownHuman(parent.authorName, op, bots);
  }).length;
}

export function wasWarned(comments: CommentRecord[], storedId: string | undefined,
  warning: string, appAuthors: ReadonlySet<string>): boolean {
  return !!storedId || (!!warning && comments.some(c => c.distinguished
    && appAuthors.has(c.authorName.toLowerCase()) && c.body.startsWith(warning)));
}

export function shouldReportRepeat(warned: boolean[], postsToCheck: number): boolean {
  return warned.length === postsToCheck && warned.every(Boolean);
}
