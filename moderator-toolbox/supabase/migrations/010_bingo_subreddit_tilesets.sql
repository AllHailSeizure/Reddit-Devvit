-- Per-subreddit active-tile override. active_tile_keys is a list of
-- bingo_tiles.value_key references only -- never duplicated tile objects,
-- so tile definitions stay identical across every subreddit.
--
-- No row for a subreddit = every tile in bingo_tiles is active by default.

CREATE TABLE bingo_subreddit_tilesets (
  subreddit_name    TEXT        PRIMARY KEY, -- lowercase, no "r/" prefix
  active_tile_keys  TEXT[]      NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bingo_subreddit_tilesets ENABLE ROW LEVEL SECURITY;
CREATE POLICY bingo_tilesets_anon_read ON bingo_subreddit_tilesets FOR SELECT TO anon USING (true);
GRANT SELECT ON bingo_subreddit_tilesets TO anon;
