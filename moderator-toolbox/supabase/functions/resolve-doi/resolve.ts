/**
 * DOI resolution and watchlist matching for the resolve-doi edge function.
 * The Devvit app calls this through Supabase. It does not talk to doi.org,
 * Crossref, or DataCite itself. Matching rules live in predatory-journal-decision.ts.
 */
import {
  DOI_CACHE_TTL_MS,
  hostsFromCrossref,
  hostsFromDatacite,
  matchPublication,
  mergeHits,
  normalizeHost,
  parseAllowlist,
  registrationAgency,
  type JournalHit,
  type ResolvedPublication,
  type WatchEntry,
} from '../../../src/server/trigger-modules/predatory-journal-decision.ts';

export { DOI_CACHE_TTL_MS };

const MAX_HOSTS = 25;
const MAX_DOIS = 8;
const GENERIC_UA = 'moderator-toolbox/resolve-doi (https://www.reddit.com/r/LLMPhysics)';

export interface DoiCacheRow {
  doi: string;
  ra: string | null;
  hosts: string[];
  publisher: string | null;
  fetchedAt: string;
}

export interface ResolveDeps {
  now?: number;
  mailto?: string;
  fetchImpl?: typeof fetch;
  readCache: (doi: string) => Promise<DoiCacheRow | null>;
  writeCache: (row: DoiCacheRow) => Promise<void>;
}

export interface ResolveBody {
  hosts?: unknown;
  dois?: unknown;
  allowlist?: unknown;
  matchPublisherName?: unknown;
}

export interface ResolveResult {
  hits: JournalHit[];
  watchlistCount: number;
}

function asStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) continue;
    out.push(item.trim());
    if (out.length >= limit) break;
  }
  return out;
}

function directHosts(value: unknown): string[] {
  const hosts: string[] = [];
  const seen = new Set<string>();
  for (const raw of asStringList(value, MAX_HOSTS)) {
    const host = normalizeHost(raw) ?? normalizeHost(raw.replace(/^https?:\/\//i, ''));
    if (!host || host === 'doi.org' || host === 'dx.doi.org' || seen.has(host)) continue;
    seen.add(host);
    hosts.push(host);
  }
  return hosts;
}

function cleanDois(value: unknown): string[] {
  const dois: string[] = [];
  const seen = new Set<string>();
  for (const raw of asStringList(value, MAX_DOIS)) {
    let doi = raw;
    try {
      doi = decodeURIComponent(raw);
    } catch {
      // Keep the raw value.
    }
    doi = doi.trim().toLowerCase();
    if (!/^10\.\d{4,9}\//.test(doi) || seen.has(doi)) continue;
    seen.add(doi);
    dois.push(doi);
  }
  return dois;
}

async function readBody(res: Response, source: string): Promise<unknown | null> {
  if (res.status >= 500) throw new Error(`${source} HTTP ${res.status}`);
  if (!res.ok) return null;
  return res.json();
}

/** Throws on 5xx so the caller does not cache a transient failure. 4xx is a cacheable miss. */
export async function fetchPublication(
  doi: string,
  mailto: string,
  fetchImpl: typeof fetch,
): Promise<ResolvedPublication & { ra: string | null }> {
  const userAgent = mailto ? `moderator-toolbox/resolve-doi (mailto:${mailto})` : GENERIC_UA;
  const headers = { Accept: 'application/json', 'User-Agent': userAgent };
  const empty = { hosts: [] as string[], publisher: null as string | null, ra: null as string | null };
  const agencyRes = await fetchImpl(`https://doi.org/doiRA/${encodeURIComponent(doi)}`, { headers });
  const agencyBody = await readBody(agencyRes, 'doiRA');
  if (!agencyBody) return empty;
  const agency = registrationAgency(agencyBody);
  if (agency === 'crossref') {
    const query = mailto ? `?mailto=${encodeURIComponent(mailto)}` : '';
    const res = await fetchImpl(`https://api.crossref.org/works/${encodeURIComponent(doi)}${query}`, { headers });
    const body = await readBody(res, 'crossref');
    const parsed = body ? hostsFromCrossref(body) : { hosts: [], publisher: null };
    return { ...parsed, ra: 'crossref' };
  }
  if (agency === 'datacite') {
    const res = await fetchImpl(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`, {
      headers: { ...headers, Accept: 'application/vnd.api+json' },
    });
    const body = await readBody(res, 'datacite');
    const parsed = body ? hostsFromDatacite(body) : { hosts: [], publisher: null };
    return { ...parsed, ra: 'datacite' };
  }
  return empty;
}

export async function publicationForDoi(doi: string, deps: ResolveDeps): Promise<ResolvedPublication> {
  const now = deps.now ?? Date.now();
  const cached = await deps.readCache(doi);
  const fresh = !!cached && Date.parse(cached.fetchedAt) > now - DOI_CACHE_TTL_MS;
  if (cached && fresh) return { hosts: cached.hosts, publisher: cached.publisher };
  let publication: Awaited<ReturnType<typeof fetchPublication>>;
  try {
    publication = await fetchPublication(doi, (deps.mailto ?? '').trim(), deps.fetchImpl ?? fetch);
  } catch (err) {
    if (cached) return { hosts: cached.hosts, publisher: cached.publisher };
    throw err;
  }
  try {
    await deps.writeCache({
      doi,
      ra: publication.ra,
      hosts: publication.hosts,
      publisher: publication.publisher,
      fetchedAt: new Date(now).toISOString(),
    });
  } catch {
    // The lookup succeeded. A cache-write failure must not drop the hit.
  }
  return { hosts: publication.hosts, publisher: publication.publisher };
}

export async function resolveHits(
  body: ResolveBody,
  entries: WatchEntry[],
  deps: ResolveDeps,
): Promise<ResolveResult> {
  if (entries.length === 0) return { hits: [], watchlistCount: 0 };
  const allowlist = parseAllowlist(typeof body.allowlist === 'string' || body.allowlist == null
    ? body.allowlist as string | null
    : null);
  const matchNames = body.matchPublisherName === true;
  const hosts = directHosts(body.hosts);
  const dois = cleanDois(body.dois);
  const publications: ResolvedPublication[] = [];
  for (const doi of dois) {
    try {
      publications.push(await publicationForDoi(doi, deps));
    } catch {
      // A 5xx is not cached. Direct hosts and the other DOIs still match.
    }
  }
  let hits = matchPublication(hosts, null, entries, allowlist, false);
  for (const publication of publications) {
    hits = mergeHits([
      ...hits,
      ...matchPublication(publication.hosts, publication.publisher, entries, allowlist, matchNames),
    ]);
  }
  return { hits, watchlistCount: entries.length };
}
