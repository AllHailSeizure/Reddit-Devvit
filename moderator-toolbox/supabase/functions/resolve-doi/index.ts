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
 * verify_jwt is false, matching process-review, so a non-JWT service key works.
 * The bearer must still equal SUPABASE_SERVICE_ROLE_KEY, the same key Devvit
 * stores as supabaseServiceKey.
 */
import { resolveHits, type DoiCacheRow, type ResolveBody } from './resolve.ts';
import type { WatchEntry } from '../../../src/server/trigger-modules/predatory-journal-decision.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function serviceHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: 'application/json',
  };
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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!serviceKey || token !== serviceKey) return json({ error: 'Unauthorized' }, 401);
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  if (!supabaseUrl) return json({ error: 'SUPABASE_URL is not set' }, 500);

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
