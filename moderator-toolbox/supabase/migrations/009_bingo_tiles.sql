-- Global bingo tile catalog, shared across every subreddit running sub-bingo.
-- One row per tile. Game-configuration metadata only (labels, trigger words,
-- check type) -- never Reddit post/comment content or usernames.
--
-- check_type = 'keyword': post_check/comment_check/triggers drive a generic
--   substring-match evaluator in the app (see sub-bingo tile-source.ts).
-- check_type = 'custom': the app looks up value_key in its own hardcoded
--   CUSTOM_VALIDATOR_REGISTRY instead of using the columns below.

CREATE TABLE bingo_tiles (
  value_key         TEXT        PRIMARY KEY,
  check_type        TEXT        NOT NULL DEFAULT 'custom'
                                   CHECK (check_type IN ('keyword', 'custom')),
  display_name      TEXT,
  label             TEXT        NOT NULL,
  game_description  TEXT,
  post_check        BOOLEAN     NOT NULL DEFAULT false,
  comment_check     BOOLEAN     NOT NULL DEFAULT false,
  triggers          TEXT[]      NOT NULL DEFAULT '{}',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Read-only for the app: only SELECT is granted to anon. Rows are edited
-- directly via the Supabase dashboard/SQL editor, never through Reddit.
ALTER TABLE bingo_tiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY bingo_tiles_anon_read ON bingo_tiles FOR SELECT TO anon USING (true);
GRANT SELECT ON bingo_tiles TO anon;
