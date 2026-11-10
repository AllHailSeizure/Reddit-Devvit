import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DOI_CACHE_TTL_MS,
  type WatchEntry,
} from './predatory-journal-decision';
import {
  bearerAuthorized,
  resolveHits,
  sha256Hex,
  timingSafeEqual,
  type DoiCacheRow,
  type ResolveDeps,
} from '../../../supabase/functions/resolve-doi/resolve.ts';

const NOW = Date.parse('2026-11-10T00:00:00Z');
const DOI = '10.1000/hijack';

const watchlist: WatchEntry[] = [
  {
    domain: 'hijack.example',
    name: 'Adalya',
    sourceList: "Beall's List",
    sourceUrl: 'https://beallslist.net/',
    listType: 'hijacked',
  },
  {
    domain: 'omicsonline.org',
    name: 'OMICS Publishing Group',
    sourceList: "Beall's List",
    sourceUrl: 'https://beallslist.net/',
    listType: 'publisher',
  },
  {
    domain: 'mdpi.com',
    name: 'MDPI',
    sourceList: "Beall's List",
    sourceUrl: 'https://beallslist.net/',
    listType: 'publisher',
  },
  {
    domain: 'frontiersin.org',
    name: 'Frontiers Media SA',
    sourceList: "Beall's List",
    sourceUrl: 'https://beallslist.net/',
    listType: 'publisher',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function memoryCache(initial: DoiCacheRow[] = []): ResolveDeps & { writes: DoiCacheRow[] } {
  const rows = new Map(initial.map((row) => [row.doi, row]));
  const writes: DoiCacheRow[] = [];
  return {
    now: NOW,
    writes,
    readCache: async (doi) => rows.get(doi) ?? null,
    writeCache: async (row) => {
      writes.push({ ...row, hosts: [...row.hosts] });
      rows.set(row.doi, row);
    },
  };
}

describe('resolve-doi', () => {
  it('matches a Crossref landing host and ignores ISSN', async () => {
    const seen: Array<{ url: string; ua: string }> = [];
    const cache = memoryCache();
    const result = await resolveHits({
      hosts: [],
      dois: [DOI],
      allowlist: '',
      matchPublisherName: false,
    }, watchlist, {
      ...cache,
      mailto: 'ops@example.com',
      fetchImpl: async (url, init) => {
        const headers = init?.headers as Record<string, string>;
        seen.push({ url, ua: headers['User-Agent'] ?? '' });
        if (url.startsWith('https://doi.org/doiRA/')) return jsonResponse([{ RA: 'Crossref' }]);
        return jsonResponse({
          message: {
            URL: 'https://www.hijack.example/article',
            ISSN: ['1234-5678'],
            publisher: 'Adalya',
            link: [{ URL: 'https://cdn.hijack.example/pdf' }],
            resource: { primary: { URL: 'https://files.hijack.example/a.pdf' } },
          },
        });
      },
    });

    expect(result.watchlistCount).toBe(watchlist.length);
    expect(result.hits.map((hit) => hit.publisherKey)).toEqual(['hijack.example']);
    expect(result.hits[0]?.publisher).toBe('Adalya');
    expect(cache.writes).toHaveLength(1);
    expect(cache.writes[0]?.hosts).toEqual([
      'hijack.example',
      'cdn.hijack.example',
      'files.hijack.example',
    ]);
    expect(cache.writes[0]?.hosts.join(' ')).not.toContain('1234');
    expect(cache.writes[0]?.ra).toBe('crossref');
    expect(seen[1]?.url).toBe(`https://api.crossref.org/works/${encodeURIComponent(DOI)}?mailto=ops%40example.com`);
    expect(seen[1]?.ua).toContain('mailto:ops@example.com');
  });

  it('omits the Crossref mailto query when the secret is blank', async () => {
    const urls: string[] = [];
    const result = await resolveHits({ dois: [DOI], allowlist: '' }, watchlist, {
      ...memoryCache(),
      mailto: '  ',
      fetchImpl: async (url) => {
        urls.push(url);
        if (url.startsWith('https://doi.org/doiRA/')) return jsonResponse([{ RA: 'Crossref' }]);
        return jsonResponse({ message: { URL: 'https://hijack.example/a', publisher: 'Adalya' } });
      },
    });
    expect(result.hits).toHaveLength(1);
    expect(urls[1]).toBe(`https://api.crossref.org/works/${encodeURIComponent(DOI)}`);
    expect(urls[1]).not.toContain('mailto');
  });

  it('matches a DataCite resource host', async () => {
    const result = await resolveHits({ dois: ['10.2000/data'], allowlist: '' }, watchlist, {
      ...memoryCache(),
      fetchImpl: async (url) => {
        if (url.startsWith('https://doi.org/doiRA/')) return jsonResponse([{ RA: 'DataCite' }]);
        expect(url).toBe('https://api.datacite.org/dois/10.2000%2Fdata');
        return jsonResponse({
          data: {
            attributes: {
              url: 'https://archive.hijack.example/item',
              publisher: { name: 'Adalya' },
              relatedIdentifiers: [{ relatedIdentifierType: 'ISSN', relatedIdentifier: '1234-5678' }],
            },
          },
        });
      },
    });
    expect(result.hits.map((hit) => hit.domain)).toEqual(['hijack.example']);
  });

  it('uses a fresh cache row and does not call the network', async () => {
    const result = await resolveHits({ dois: [DOI], allowlist: '' }, watchlist, {
      ...memoryCache(),
      fetchImpl: async () => {
        throw new Error('network should not be called');
      },
      readCache: async () => ({
        doi: DOI,
        ra: 'crossref',
        hosts: ['hijack.example'],
        publisher: 'Adalya',
        fetchedAt: new Date(NOW - 60_000).toISOString(),
      }),
    });
    expect(result.hits[0]?.publisherKey).toBe('hijack.example');
  });

  it('refetches a row older than 14 days and keeps the stale row when the lookup fails', async () => {
    const cache = memoryCache([{
      doi: DOI,
      ra: 'crossref',
      hosts: ['hijack.example'],
      publisher: 'Adalya',
      fetchedAt: new Date(NOW - DOI_CACHE_TTL_MS).toISOString(),
    }]);
    const result = await resolveHits({ dois: [DOI], allowlist: '' }, watchlist, {
      ...cache,
      fetchImpl: async () => new Response('down', { status: 503 }),
    });
    expect(result.hits[0]?.publisherKey).toBe('hijack.example');
    expect(cache.writes).toEqual([]);
  });

  it('does not cache a 5xx and still returns direct host hits', async () => {
    const cache = memoryCache();
    const result = await resolveHits({
      hosts: ['www.hijack.example'],
      dois: [DOI],
      allowlist: '',
      matchPublisherName: false,
    }, watchlist, {
      ...cache,
      fetchImpl: async () => new Response('down', { status: 503 }),
    });
    expect(result.hits.map((hit) => hit.publisherKey)).toEqual(['hijack.example']);
    expect(cache.writes).toEqual([]);
  });

  it('still returns a resolved DOI when the cache write fails', async () => {
    const result = await resolveHits({ dois: [DOI], allowlist: '' }, watchlist, {
      ...memoryCache(),
      writeCache: async () => {
        throw new Error('cache down');
      },
      fetchImpl: async (url) => {
        if (url.startsWith('https://doi.org/doiRA/')) return jsonResponse([{ RA: 'Crossref' }]);
        return jsonResponse({ message: { URL: 'https://hijack.example/a', publisher: 'Adalya' } });
      },
    });
    expect(result.hits.map((hit) => hit.publisherKey)).toEqual(['hijack.example']);
  });

  it('caches a 404 as a miss', async () => {
    const cache = memoryCache();
    const result = await resolveHits({ dois: [DOI], allowlist: '' }, watchlist, {
      ...cache,
      fetchImpl: async () => new Response('missing', { status: 404 }),
    });
    expect(result.hits).toEqual([]);
    expect(cache.writes[0]).toMatchObject({ doi: DOI, ra: null, hosts: [], publisher: null });
  });

  it('does not match a publisher name unless asked, and never matches a parent or sibling host', async () => {
    const named = {
      hosts: [],
      publisher: 'OMICS Publishing Group',
    };
    const fetchImpl = async (url: string) => {
      if (url.startsWith('https://doi.org/doiRA/')) return jsonResponse([{ RA: 'Crossref' }]);
      return jsonResponse({ message: { URL: 'https://unlisted.example/paper', publisher: named.publisher } });
    };
    const off = await resolveHits({
      hosts: ['example', 'not-hijack.example'],
      dois: ['10.3000/name'],
      allowlist: '',
      matchPublisherName: false,
    }, watchlist, { ...memoryCache(), fetchImpl });
    expect(off.hits).toEqual([]);

    const on = await resolveHits({
      dois: ['10.3000/name'],
      allowlist: '',
      matchPublisherName: true,
    }, watchlist, { ...memoryCache(), fetchImpl });
    expect(on.hits.map((hit) => hit.publisherKey)).toEqual(['name:omics-publishing-group']);
  });

  it('keeps the default allowlist, including MDPI and Frontiers, and honors a blank one', async () => {
    const fetchImpl = async () => {
      throw new Error('direct hosts do not need a lookup');
    };
    const defaults = await resolveHits({
      hosts: ['www.mdpi.com', 'www.frontiersin.org'],
      allowlist: null,
    }, watchlist, { ...memoryCache(), fetchImpl });
    expect(defaults.hits).toEqual([]);

    const cleared = await resolveHits({
      hosts: ['mdpi.com'],
      allowlist: '',
    }, watchlist, { ...memoryCache(), fetchImpl });
    expect(cleared.hits.map((hit) => hit.domain)).toEqual(['mdpi.com']);
  });

  it('does not resolve when the watchlist is empty or the DOI is not a 10. prefix', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return jsonResponse([{ RA: 'Crossref' }]);
    };
    const empty = await resolveHits({
      hosts: ['hijack.example'],
      dois: [DOI],
    }, [], { ...memoryCache(), fetchImpl });
    expect(empty).toEqual({ hits: [], watchlistCount: 0 });

    await resolveHits({
      dois: ['not-a-doi', '9.1000/nope'],
      allowlist: '',
    }, watchlist, { ...memoryCache(), fetchImpl });
    expect(calls).toBe(0);
  });

  it('leaves doi.org, Crossref, and DataCite off the Devvit HTTP allowlist', () => {
    const devvit = JSON.parse(readFileSync(new URL('../../../devvit.json', import.meta.url), 'utf8')) as {
      permissions: { http: { domains: string[] } };
      settings: { subreddit: Record<string, unknown> };
    };
    expect(devvit.permissions.http.domains).toEqual([
      'en.wikipedia.org',
      'generativelanguage.googleapis.com',
      'eimdgqymjwfljtapnuyl.supabase.co',
    ]);
    expect(devvit.settings.subreddit.predatoryWatchCrossrefMailto).toBeUndefined();
    expect(devvit.settings.subreddit.predatoryWatchCacheTtlHours).toBeUndefined();
    expect(devvit.settings.subreddit.predatoryWatchAllowlist).toBeDefined();
  });
});

describe('resolve-doi bearer auth', () => {
  const token = 'a'.repeat(64);

  it('accepts a server key without loading hashes', async () => {
    let loaded = false;
    const ok = await bearerAuthorized('sb_secret_x', ['legacy', 'sb_secret_x'], async () => {
      loaded = true;
      return [];
    });
    expect(ok).toBe(true);
    expect(loaded).toBe(false);
  });

  it('accepts a token whose sha256 is stored', async () => {
    const hash = await sha256Hex(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await bearerAuthorized(token, ['legacy'], async () => ['0'.repeat(64), hash.toUpperCase()])).toBe(true);
  });

  it('rejects a blank, unknown, or raw-hash bearer', async () => {
    const hash = await sha256Hex(token);
    expect(await bearerAuthorized('', [''], async () => [hash])).toBe(false);
    expect(await bearerAuthorized('wrong', ['legacy'], async () => [hash])).toBe(false);
    expect(await bearerAuthorized(hash, ['legacy'], async () => [hash])).toBe(false);
  });

  it('compares strings of different lengths safely', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
});
