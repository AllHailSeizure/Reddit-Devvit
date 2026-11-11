/**
 * sync-predatory-watchlist — Supabase Edge Function
 *
 * POST (or GET) with Authorization: Bearer <function token or server key>.
 * Refreshes predatory_watchlist from the pluggable sources in sources.mjs.
 * Rows missing from a successful sync are marked active = false.
 * A source that returns fewer than its minRows, or a failed page inside a
 * group, does not deactivate that group's existing rows.
 *
 * Auth matches resolve-doi: verify_jwt is false, and the bearer must either
 * equal a server key (SUPABASE_SERVICE_ROLE_KEY or one of SUPABASE_SECRET_KEYS),
 * or hash (SHA-256 hex) to a row in public.function_tokens (migration 016).
 * REST calls use the first available server key; new sb_secret_ keys go on
 * the apikey header only.
 *
 * Schedule: supabase/functions/sync-predatory-watchlist/CRON.sql
 * (not applied by migrations — it needs a bearer stored in Vault).
 */
import { SOURCE_GROUPS, assertAllowedSource, parseSourcePage } from './sources.mjs';
import { mergeRows } from './parse.mjs';

/** Compares two strings without returning early on the first mismatch. */
function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * True when the bearer equals a server key, or its SHA-256 hex matches
 * one of the stored function_tokens hashes. Hashes load only when needed.
 */
async function bearerAuthorized(
  token: string,
  serverKeys: string[],
  loadHashes: () => Promise<string[]>,
): Promise<boolean> {
  if (!token) return false;
  let keyMatch = false;
  for (const key of serverKeys) {
    if (key && timingSafeEqual(token, key)) keyMatch = true;
  }
  if (keyMatch) return true;
  const hash = await sha256Hex(token);
  let match = false;
  for (const stored of await loadHashes()) {
    if (timingSafeEqual(hash, stored.trim().toLowerCase())) match = true;
  }
  return match;
}

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

function serviceHeaders(serviceKey: string): Record<string, string> {
  // New sb_secret_ keys go on apikey only; a non-JWT bearer is rejected by REST.
  const headers: Record<string, string> = { apikey: serviceKey, Accept: 'application/json' };
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`;
  return headers;
}

/**
 * Server keys injected into the function. The legacy service role key can be
 * empty once a project moves to the new API keys, so SUPABASE_SECRET_KEYS
 * (a JSON map of name -> sb_secret_ key) is read too. The first is used for REST.
 */
function serverKeys(): string[] {
  const keys: string[] = [];
  const legacy = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
  if (legacy) keys.push(legacy);
  try {
    const parsed = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, unknown>;
    const ordered = ['default', ...Object.keys(parsed).filter((name) => name !== 'default')];
    for (const name of ordered) {
      const value = parsed[name];
      if (typeof value === 'string' && value.trim()) keys.push(value.trim());
    }
  } catch {
    // Malformed SUPABASE_SECRET_KEYS: fall back to whatever legacy key exists.
  }
  return keys;
}

/** Accepts a server key (service role or secret), or a token whose SHA-256 is in function_tokens. */
async function isAuthorized(token: string, keys: string[], supabaseUrl: string): Promise<boolean> {
  const serviceKey = keys[0] ?? '';
  return bearerAuthorized(token, keys, async () => {
    const res = await fetch(`${supabaseUrl}/rest/v1/function_tokens?select=token_sha256`, {
      headers: serviceHeaders(serviceKey),
    });
    if (!res.ok) throw new Error(`function_tokens HTTP ${res.status}`);
    const rows = await res.json() as Array<Record<string, unknown>>;
    return (Array.isArray(rows) ? rows : [])
      .map((row) => row.token_sha256)
      .filter((hash): hash is string => typeof hash === 'string');
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
          ...serviceHeaders(serviceKey),
          'Content-Type': 'application/json',
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
      ...serviceHeaders(serviceKey),
      'Content-Type': 'application/json',
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
  const keys = serverKeys();
  const serviceKey = keys[0] ?? '';
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  if (!serviceKey) return json({ error: 'No server key is available to the function (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEYS)' }, 500);
  if (!supabaseUrl) return json({ error: 'SUPABASE_URL is not set' }, 500);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  let authorized = false;
  try {
    authorized = await isAuthorized(token, keys, supabaseUrl);
  } catch (err) {
    console.error(err);
    return json({ error: 'Auth check failed' }, 500);
  }
  if (!authorized) return json({ error: 'Unauthorized' }, 401);

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
