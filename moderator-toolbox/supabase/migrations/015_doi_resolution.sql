-- Cache of DOI registration-agency lookups for resolve-doi.
-- The Devvit app does not read this table and does not call doi.org.
-- Service role only. A row is reused for 14 days by the edge function.
-- 5xx responses are not written. ISSN is not stored.

CREATE TABLE doi_resolution (
  doi         TEXT        PRIMARY KEY,
  ra          TEXT,
  hosts       TEXT[]      NOT NULL DEFAULT '{}',
  publisher   TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doi_resolution_doi_chk
    CHECK (doi = lower(doi) AND doi LIKE '10.%')
);

ALTER TABLE doi_resolution ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON doi_resolution TO service_role;

COMMENT ON TABLE doi_resolution IS
  'DOI landing hosts cached by the resolve-doi edge function. Not readable by anon.';
