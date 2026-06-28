// Shared types used by the bingo engine and deployment-specific tile definitions.
// Tile implementations (TILE_VALIDATORS) stay in the deployment; only the contracts live here.

export type BingoEventType = 'post_submit' | 'comment_create' | 'post_delete' | 'post_report' | 'comment_report' | 'mod_action';

export type BingoEvent = {
  type: BingoEventType;
  ts: number;
  author?: string;
  title?: string;
  body?: string;
  flair?: string;
  postId?: string;
  meta?: string;
};

/** A single post plus the data needed to evaluate count-based tiles. */
export type CountedThread = {
  postId: string;
  opAuthor: string;
  title: string;
  body: string;
  comments: { author: string; body: string }[];
  /** mod-removal actions recorded against this post over its lifetime */
  modRemovals: number;
  /** depth-cap comment reports (automated bot reports with reason "Depth cap trigger") */
  depthCapReports: number;
};

/** A tile that has fired during evaluation. */
export type TriggeredTile = { valueKey: string; triggeredBy: string | null };

export type TileValidatorDefinition = {
  valueKey: string;
  validate: (thread: CountedThread) => boolean;
  /** Optional: when validate fires, return the username most responsible. null = community trigger. */
  attribute?: (thread: CountedThread) => string | null;
  displayName?: string;
  label: string;
  gameDescription?: string;
};
