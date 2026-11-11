/**
 * resolve-doi — Supabase Edge Function
 *
 * POST { hosts, dois, allowlist, matchPublisherName }
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Resolves DOIs through doi.org, Crossref, and DataCite, caches each result
 * in doi_resolution, and returns watchlist hits. The Devvit app never calls
 * those hosts itself. Crossref mailto comes from the CROSSREF_MAILTO secret
 * (blank still works, with a generic user agent).
 *
 * verify_jwt is false, matching process-review, so a non-JWT bearer works.
 * The bearer must either equal a server key (SUPABASE_SERVICE_ROLE_KEY or one of
 * SUPABASE_SECRET_KEYS), or hash (SHA-256 hex)
 * to a row in public.function_tokens (migration 016). Devvit sends its
 * supabaseFunctionToken setting, falling back to supabaseServiceKey.
 */
import { bearerAuthorized, resolveHits, type DoiCacheRow, type ResolveBody } from './resolve.ts';
import type { WatchEntry } from '../../../src/server/trigger-modules/predatory-journal-decision.ts';

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

async function fetchWatchlist(supabaseUrl: string, serviceKey: string): Promise<WatchEntry[]> {
  const entries: WatchEntry[] = [];
  const pageSize = 1000;
  let previousFirst = '';
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const url = `${supabaseUrl}/rest/v1/predatory_watchlist?active=eq.true&select=domain,name,source_list,source_url,list_type&order=domain.asc,source_list.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers: serviceHeaders(serviceKey) });
    if (!res.ok) throw new Error(`watchlist HTTP ${res.status}`);
    const rows = await res.json() as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length === 0) break;
    const first = typeof rows[0]?.domain === 'string' ? rows[0].domain : '';
    if (first && first === previousFirst) break;
    previousFirst = first;
    for (const row of rows) {
      if (typeof row.domain !== 'string' || !row.domain) continue;
      entries.push({
        domain: row.domain,
        name: typeof row.name === 'string' ? row.name : '',
        sourceList: typeof row.source_list === 'string' ? row.source_list : '',
        sourceUrl: typeof row.source_url === 'string' ? row.source_url : '',
        listType: typeof row.list_type === 'string' ? row.list_type : '',
      });
    }
    if (rows.length < pageSize) break;
  }
  return entries;
}

async function readCache(supabaseUrl: string, serviceKey: string, doi: string): Promise<DoiCacheRow | null> {
  const url = `${supabaseUrl}/rest/v1/doi_resolution?doi=eq.${encodeURIComponent(doi)}&select=doi,ra,hosts,publisher,fetched_at&limit=1`;
  const res = await fetch(url, { headers: serviceHeaders(serviceKey) });
  if (!res.ok) throw new Error(`doi cache read HTTP ${res.status}`);
  const rows = await res.json() as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row || typeof row.doi !== 'string') return null;
  return {
    doi: row.doi,
    ra: typeof row.ra === 'string' ? row.ra : null,
    hosts: Array.isArray(row.hosts) ? row.hosts.filter((host): host is string => typeof host === 'string') : [],
    publisher: typeof row.publisher === 'string' ? row.publisher : null,
    fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : '',
  };
}

async function writeCache(supabaseUrl: string, serviceKey: string, row: DoiCacheRow): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/doi_resolution?on_conflict=doi`, {
    method: 'POST',
    headers: {
      ...serviceHeaders(serviceKey),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      doi: row.doi,
      ra: row.ra,
      hosts: row.hosts,
      publisher: row.publisher,
      fetched_at: row.fetchedAt,
    }),
  });
  if (!res.ok) throw new Error(`doi cache write HTTP ${res.status} ${await res.text()}`);
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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
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

  let body: ResolveBody;
  try {
    body = await req.json() as ResolveBody;
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  try {
    const entries = await fetchWatchlist(supabaseUrl, serviceKey);
    const result = await resolveHits(body, entries, {
      mailto: Deno.env.get('CROSSREF_MAILTO') ?? '',
      readCache: (doi) => readCache(supabaseUrl, serviceKey, doi),
      writeCache: (row) => writeCache(supabaseUrl, serviceKey, row),
    });
    return json(result);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});
