/**
 * sync-predatory-watchlist — Supabase Edge Function
 *
 * POST (or GET) with Authorization: Bearer <service role key>.
 * Refreshes predatory_watchlist from the pluggable sources in sources.mjs.
 * Rows missing from a successful sync are marked active = false.
 * A source that returns fewer than its minRows, or a failed page inside a
 * group, does not deactivate that group's existing rows.
 *
 * Schedule: supabase/functions/sync-predatory-watchlist/CRON.sql
 * (not applied by migrations — it needs the service role key).
 */
import { SOURCE_GROUPS, assertAllowedSource, parseSourcePage } from './sources.mjs';
import { mergeRows } from './parse.mjs';

const USER_AGENT = 'moderator-toolbox-watchlist-sync/1.0 (journal integrity warning; +https://www.reddit.com/r/LLMPhysics)';

interface WatchRow {
  domain: string;
  name: string;
  listType: string;
}

interface SourceGroup {
  id: string;
  sourceList: string;
  sourceUrl: string;
  minRows: number;
  pages: Array<{ id: string; url: string; kind: string; listType: string }>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function upsert(
  supabaseUrl: string,
  serviceKey: string,
  group: SourceGroup,
  rows: WatchRow[],
  runAt: string,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += 200) {
    const chunk = rows.slice(offset, offset + 200).map((row) => ({
      domain: row.domain,
      name: row.name || row.domain,
      source_list: group.sourceList,
      source_url: group.sourceUrl,
      list_type: row.listType,
      active: true,
      last_seen_at: runAt,
      updated_at: runAt,
    }));
    const res = await fetch(
      `${supabaseUrl}/rest/v1/predatory_watchlist?on_conflict=domain,source_list`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(chunk),
      },
    );
    if (!res.ok) {
      throw new Error(`upsert ${group.id} failed: ${res.status} ${await res.text()}`);
    }
  }
}

async function deactivateStale(
  supabaseUrl: string,
  serviceKey: string,
  sourceList: string,
  runAt: string,
): Promise<void> {
  const filter = [
    `source_list=eq.${encodeURIComponent(sourceList)}`,
    'active=eq.true',
    `or=(last_seen_at.is.null,last_seen_at.lt.${encodeURIComponent(runAt)})`,
  ].join('&');
  const res = await fetch(`${supabaseUrl}/rest/v1/predatory_watchlist?${filter}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    throw new Error(`deactivate ${sourceList} failed: ${res.status} ${await res.text()}`);
  }
}

async function syncGroup(
  supabaseUrl: string,
  serviceKey: string,
  group: SourceGroup,
): Promise<Record<string, unknown>> {
  const pages: Array<Record<string, unknown>> = [];
  const parsed: WatchRow[] = [];
  let failed = false;
  for (const page of group.pages) {
    try {
      assertAllowedSource(page.url);
      const res = await fetch(page.url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/csv,text/plain,*/*' },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = parseSourcePage(page, await res.text()) as WatchRow[];
      parsed.push(...rows);
      pages.push({ page: page.id, rows: rows.length });
    } catch (err) {
      failed = true;
      pages.push({ page: page.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const merged = mergeRows(parsed) as WatchRow[];
  if (merged.length < group.minRows) {
    return {
      group: group.id,
      pages,
      upserted: 0,
      deactivated: false,
      reason: `parsed ${merged.length} rows; need at least ${group.minRows} before replacing this source`,
    };
  }

  const runAt = new Date().toISOString();
  await upsert(supabaseUrl, serviceKey, group, merged, runAt);
  let deactivated = false;
  if (!failed) {
    await deactivateStale(supabaseUrl, serviceKey, group.sourceList, runAt);
    deactivated = true;
  }
  return { group: group.id, pages, upserted: merged.length, deactivated };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!serviceKey || token !== serviceKey) return json({ error: 'Unauthorized' }, 401);
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  if (!supabaseUrl) return json({ error: 'SUPABASE_URL is not set' }, 500);

  try {
    const summary = [];
    for (const group of SOURCE_GROUPS) {
      summary.push(await syncGroup(supabaseUrl, serviceKey, group));
    }
    return json({ ok: true, summary });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
