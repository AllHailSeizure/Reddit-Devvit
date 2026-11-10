import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALLOWLIST,
  DEFAULT_WARNING,
  domainMatches,
  extractDois,
  extractUrls,
  hostsFromCrossref,
  hostsFromDatacite,
  hostsFromText,
  isAllowlisted,
  isAppAuthor,
  matchPublication,
  normalizeHost,
  parseAllowlist,
  registrableDomain,
  registrationAgency,
  renderWarning,
  selectUnwarned,
  type WatchEntry,
} from './predatory-journal-decision';

const entry = (domain: string, name: string, sourceList = 'Beall\'s List', listType = 'publisher'): WatchEntry => ({
  domain,
  name,
  sourceList,
  sourceUrl: sourceList.startsWith('Retraction')
    ? 'https://retractionwatch.com/the-retraction-watch-hijacked-journal-checker/'
    : 'https://beallslist.net/',
  listType,
});

const allow = parseAllowlist(DEFAULT_ALLOWLIST);

describe('url and doi extraction', () => {
  it('extracts bare, markdown, and www urls and trims trailing punctuation', () => {
    const text = 'See https://Journal.Example.com/a. and [paper](https://cdn.example.com/x) plus www.other.example/path).';
    expect(extractUrls(text)).toEqual([
      'https://Journal.Example.com/a',
      'https://cdn.example.com/x',
      'www.other.example/path',
    ]);
    expect(hostsFromText(text)).toEqual(['journal.example.com', 'cdn.example.com', 'other.example']);
  });

  it('extracts bare, doi:, doi.org, and dx.doi.org forms and ignores non-10 prefixes', () => {
    const text = [
      'Bare 10.1234/AbC.',
      'doi: 10.5678/xyz)',
      'https://doi.org/10.1111/test',
      'https://dx.doi.org/10.2222%2Fenc',
      'Fake 16.1234/nope and 20.1234/also-no and 10.12/short',
    ].join(' ');
    expect(extractDois(text).slice().sort()).toEqual([
      '10.1111/test',
      '10.1234/abc',
      '10.2222/enc',
      '10.5678/xyz',
    ]);
  });

  it('does not treat a doi.org link as a publisher host', () => {
    expect(hostsFromText('https://doi.org/10.1000/xyz and https://hijack.example/paper')).toEqual(['hijack.example']);
  });
});

describe('domain normalization and matching', () => {
  it('lowercases, strips www, a port, and a trailing dot', () => {
    expect(normalizeHost('WWW.Example.COM.')).toBe('example.com');
    expect(normalizeHost('example.com:443')).toBe('example.com');
    expect(normalizeHost('co.uk')).toBeNull();
    expect(registrableDomain('foo.bar.co.uk')).toBe('bar.co.uk');
  });

  it('matches the listed domain and its subdomains, not the parent or a sibling', () => {
    expect(domainMatches('www.journals.example.com', 'example.com')).toBe(true);
    expect(domainMatches('foo.bar.co.uk', 'bar.co.uk')).toBe(true);
    expect(domainMatches('example.com', 'journals.example.com')).toBe(false);
    expect(domainMatches('other.example.com', 'journals.example.com')).toBe(false);
    expect(domainMatches('bbc.co.uk', 'co.uk')).toBe(false);
  });
});

describe('allowlist and matching', () => {
  const watchlist = [
    entry('omicsonline.org', 'OMICS Publishing Group'),
    entry('mdpi.com', 'MDPI'),
    entry('frontiersin.org', 'Frontiers Media SA'),
    entry('evil.example', 'Frontiers Media'),
    entry('hijack.example', 'Adalya', 'Retraction Watch Hijacked Journal Checker', 'hijacked'),
    entry('named-only.example', 'Totally Predatory Press'),
  ];

  it('suppresses default MDPI and Frontiers domains and whole-word publisher names', () => {
    expect(isAllowlisted('www.mdpi.com', null, allow)).toBe(true);
    expect(isAllowlisted('journals.frontiersin.org', null, allow)).toBe(true);
    expect(isAllowlisted('evil.example', 'Frontiers Media SA', allow)).toBe(true);
    expect(isAllowlisted('omicsonline.org', 'OMICS Publishing Group', allow)).toBe(false);
    expect(matchPublication(
      ['www.mdpi.com', 'sub.omicsonline.org', 'evil.example'],
      null,
      watchlist,
      allow,
      false,
    ).map((hit) => hit.domain)).toEqual(['omicsonline.org']);
  });

  it('uses landing domains and ignores publisher names unless the secondary check is on', () => {
    const off = matchPublication(['nature.com'], 'OMICS Publishing Group', watchlist, allow, false);
    expect(off).toEqual([]);
    const on = matchPublication(['nature.com'], 'OMICS Publishing Group', watchlist, allow, true);
    expect(on.map((hit) => hit.publisherKey)).toEqual(['name:omics-publishing-group']);
    const allowedName = matchPublication(['nature.com'], 'Frontiers Media SA', watchlist, allow, true);
    expect(allowedName).toEqual([]);
  });

  it('does not match on ISSN and combines two publishers into one warning', () => {
    const crossref = hostsFromCrossref({
      message: {
        ISSN: ['1234-5678'],
        URL: 'https://www.hijack.example/article',
        link: [{ URL: 'https://cdn.hijack.example/paper.pdf' }],
        resource: { primary: { URL: 'https://hijack.example/landing' } },
        publisher: 'Adalya',
      },
    });
    expect(crossref.hosts).toEqual(['hijack.example', 'cdn.hijack.example']);
    expect(hostsFromCrossref({ message: { ISSN: ['1234-5678'], publisher: 'Adalya' } }).hosts).toEqual([]);
    expect(hostsFromDatacite({
      data: { attributes: { url: 'https://zenodo.org/records/1', publisher: { name: 'Zenodo' } } },
    })).toEqual({ hosts: ['zenodo.org'], publisher: 'Zenodo' });
    expect(registrationAgency([{ DOI: '10.1/abc', RA: 'Crossref' }])).toBe('crossref');
    expect(registrationAgency([{ RA: 'DataCite' }])).toBe('datacite');
    expect(registrationAgency([{ RA: 'mEDRA' }])).toBeNull();

    const hits = matchPublication(
      ['omicsonline.org', 'hijack.example'],
      null,
      watchlist,
      allow,
      false,
    );
    const text = renderWarning(DEFAULT_WARNING, hits);
    expect(text.split('\n\n')).toHaveLength(2);
    expect(text).toContain('OMICS Publishing Group');
    expect(text).toContain('[Beall\'s List](https://beallslist.net/)');
    expect(text).toContain('[Retraction Watch Hijacked Journal Checker](https://retractionwatch.com/the-retraction-watch-hijacked-journal-checker/)');
    expect(renderWarning('Note {source list}.', hits.slice(0, 1))).toBe('Note Beall\'s List.');
    expect(renderWarning('   ', hits)).toBe('');
  });
});

describe('once per publisher per post', () => {
  const watchlist = [
    entry('omicsonline.org', 'OMICS Publishing Group'),
    entry('hijack.example', 'Adalya'),
  ];
  const hits = matchPublication(['a.omicsonline.org', 'hijack.example', 'www.omicsonline.org'], null, watchlist, allow, false);

  it('collapses repeat domains and drops publishers already claimed on the post', () => {
    expect(hits.map((hit) => hit.publisherKey)).toEqual(['omicsonline.org', 'hijack.example']);
    expect(selectUnwarned(hits, ['omicsonline.org']).map((hit) => hit.publisherKey)).toEqual(['hijack.example']);
    expect(selectUnwarned(hits, ['omicsonline.org', 'name:omics-publishing-group', 'hijack.example'])).toEqual([]);
  });

  it('treats a claimed publisher name as already warned for a later name-only hit', () => {
    const nameHit = matchPublication([], 'OMICS Publishing Group', watchlist, allow, true);
    expect(selectUnwarned(nameHit, ['name:omics-publishing-group'])).toEqual([]);
    expect(selectUnwarned(nameHit, []).map((hit) => hit.publisherKey)).toEqual(['name:omics-publishing-group']);
  });
});

describe('settings helpers', () => {
  it('identifies the app account and parses the allowlist', () => {
    expect(isAppAuthor('LLMPhysics-bot', 'llmphysics-bot')).toBe(true);
    expect(isAppAuthor('someone', 'llmphysics-bot')).toBe(false);
    expect(parseAllowlist(undefined)).toEqual(parseAllowlist(DEFAULT_ALLOWLIST));
    expect(parseAllowlist(null)).toEqual(parseAllowlist(DEFAULT_ALLOWLIST));
    expect(parseAllowlist('   ')).toEqual({ domains: [], names: [] });
    expect(parseAllowlist('example.com, Real Publisher\nsecond.example')).toEqual({
      domains: ['example.com', 'second.example'],
      names: ['Real Publisher'],
    });
  });
});
