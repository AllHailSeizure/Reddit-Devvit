-- Predatory and hijacked journal domains for the predatory-journal-watch module.
-- The resolve-doi edge function matches link and DOI landing domains against active rows.
-- ISSN is intentionally absent: hijacked journals copy real ISSNs.
--
-- Writes come from the sync-predatory-watchlist edge function using the
-- service role (RLS bypass). anon/authenticated may read active rows only,
-- matching bingo_tiles. resolve-doi reads with the service role.

CREATE TABLE predatory_watchlist (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  domain        TEXT        NOT NULL,
  name          TEXT        NOT NULL DEFAULT '',
  source_list   TEXT        NOT NULL,
  source_url    TEXT        NOT NULL,
  list_type     TEXT        NOT NULL CHECK (list_type IN ('publisher', 'standalone', 'hijacked')),
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT predatory_watchlist_domain_chk
    CHECK (domain = lower(domain) AND position('.' IN domain) > 0 AND domain !~ '\s'),
  CONSTRAINT predatory_watchlist_domain_source_key UNIQUE (domain, source_list)
);

CREATE INDEX predatory_watchlist_active_domain_idx
  ON predatory_watchlist (domain)
  WHERE active;

CREATE INDEX predatory_watchlist_source_list_idx
  ON predatory_watchlist (source_list);

ALTER TABLE predatory_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY predatory_watchlist_read
  ON predatory_watchlist
  FOR SELECT
  TO anon, authenticated
  USING (active = TRUE);

GRANT SELECT ON predatory_watchlist TO anon;
GRANT SELECT ON predatory_watchlist TO authenticated;
-- The sync function writes with the service role, which bypasses RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON predatory_watchlist TO service_role;

COMMENT ON TABLE predatory_watchlist IS
  'Active predatory/hijacked domains. Refreshed by sync-predatory-watchlist and read by resolve-doi. See supabase/functions/sync-predatory-watchlist/CRON.sql for the daily schedule (applied manually; not part of db push).';
