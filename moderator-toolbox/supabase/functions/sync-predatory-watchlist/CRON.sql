-- Daily refresh of predatory_watchlist. NOT a migration.
--
-- Apply this yourself in the Supabase SQL editor only after:
--   1. migration 014_predatory_watchlist.sql has been applied
--   2. `supabase functions deploy sync-predatory-watchlist` has succeeded
--
-- Do not commit the service-role key. Store it in Vault, then schedule the job.
-- Dashboard alternative: Edge Functions → sync-predatory-watchlist → Schedules,
-- cron `0 6 * * *`, POST, Authorization bearer = the service role key.
--
-- Vault secrets expected by the statement below:
--   project_url       https://eimdgqymjwfljtapnuyl.supabase.co   (no trailing slash)
--   service_role_key  the service role key (not the anon or publishable key)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-predatory-watchlist') THEN
    PERFORM cron.unschedule('sync-predatory-watchlist');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-predatory-watchlist',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/sync-predatory-watchlist',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'
      )
    ),
    body := '{"reason":"cron"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
