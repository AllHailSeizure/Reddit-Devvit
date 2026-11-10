-- Bearer tokens that edge functions accept in place of the service role key.
-- Only the SHA-256 hex of each token is stored; the raw token lives in the
-- caller's secret settings (for example Devvit's supabaseFunctionToken).
-- Service role only: RLS is on with no policies, and anon/authenticated have
-- no grants. Edge functions read it with the built-in service role key.

CREATE TABLE public.function_tokens (
  name          TEXT        PRIMARY KEY,
  token_sha256  TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT function_tokens_sha256_chk CHECK (token_sha256 ~ '^[0-9a-f]{64}$')
);

ALTER TABLE public.function_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.function_tokens FROM anon, authenticated, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.function_tokens TO service_role;

COMMENT ON TABLE public.function_tokens IS
  'SHA-256 hashes of bearer tokens accepted by edge functions (resolve-doi). Never store raw tokens.';

-- Add or rotate a token (run in the SQL editor, hash only):
--   INSERT INTO public.function_tokens (name, token_sha256)
--   VALUES ('moderator-toolbox', '<sha256 hex of token>')
--   ON CONFLICT (name) DO UPDATE SET token_sha256 = EXCLUDED.token_sha256, created_at = NOW();
