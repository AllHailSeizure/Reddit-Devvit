/**
 * Pure decisions for predatory-journal-watch.
 * Domain matching is the signal. ISSN is never consulted: hijacked journals copy real ISSNs.
 * One warning comment lists every new publisher in the item. A publisher already warned on
 * that post (from the post or an earlier comment) is skipped.
 */

export const DEFAULT_WARNING =
  'Note that {publisher} appears on [{source_list}]({source_url}) as a possible [predatory journal](https://en.wikipedia.org/wiki/Predatory_publishing).';

export const DEFAULT_ALLOWLIST = 'mdpi.com\nfrontiersin.org\nMDPI\nFrontiers';

export const WARNED_TTL_MS = 180 * 24 * 60 * 60 * 1000;
export const HANDLED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const DOI_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_URLS = 25;
export const MAX_DOIS = 8;

/** Multi-part public suffixes. A watchlist row that is only one of these must not match. */
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'net.uk',
  'com.au', 'net.au', 'org.au', 'edu.au',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp',
  'com.br', 'com.mx', 'gob.mx', 'co.za', 'ac.za', 'com.tr',
  'co.in', 'ac.in', 'com.cn', 'edu.cn', 'com.tw', 'com.hk',
  'co.kr', 'com.sg', 'com.ar', 'co.nz', 'org.nz', 'ac.nz',
  'com.ua', 'com.pl', 'com.pt', 'co.id', 'ac.id', 'com.my',
]);

const SINGLE_SUFFIXES = new Set(['com', 'org', 'net', 'edu', 'gov', 'mil', 'int']);

export interface WatchEntry {
  domain: string;
  name: string;
  sourceList: string;
  sourceUrl: string;
  listType: string;
}

export interface JournalHit {
  /** Redis identity. Shortest matching watchlist domain, or a name key for name-only hits. */
  publisherKey: string;
  /** Set when the watchlist row has a publisher/journal name, so a later name hit can see the claim. */
  nameKey: string | null;
  publisher: string;
  sourceList: string;
  sourceUrl: string;
  domain: string;
}

export interface Allowlist {
  domains: string[];
  names: string[];
}

export interface ResolvedPublication {
  hosts: string[];
  publisher: string | null;
}

export function isPublicSuffix(host: string): boolean {
  return SINGLE_SUFFIXES.has(host) || MULTI_PART_SUFFIXES.has(host);
}

/** Lowercase, strip a trailing dot, a port, and one leading www. Reject public suffixes. */
export function normalizeHost(raw: string): string | null {
  let host = raw.trim().toLowerCase();
  if (!host || host.startsWith('[')) return null;
  host = host.replace(/\.$/, '');
  const colon = host.lastIndexOf(':');
  if (colon > -1 && /^\d+$/.test(host.slice(colon + 1))) host = host.slice(0, colon);
  if (host.startsWith('www.')) host = host.slice(4);
  if (!host.includes('.') || host.includes('..') || host.startsWith('.') || host.endsWith('.')) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  if (isPublicSuffix(host)) return null;
  return host;
}

export function registrableDomain(host: string): string | null {
  const normalized = normalizeHost(host);
  if (!normalized) return null;
  const labels = normalized.split('.');
  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo) && labels.length >= 3) return labels.slice(-3).join('.');
  return lastTwo;
}

export function hostFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return normalizeHost(new URL(withScheme).hostname);
  } catch {
    return null;
  }
}

/**
 * A direct link matches when its host is the watchlist domain or a subdomain of it.
 * The parent of a listed subdomain does not match, and neither do sibling subdomains.
 */
export function domainMatches(candidateHost: string, watchDomain: string): boolean {
  const host = normalizeHost(candidateHost) ?? hostFromUrl(candidateHost);
  const watch = normalizeHost(watchDomain) ?? hostFromUrl(watchDomain);
  if (!host || !watch) return false;
  return host === watch || host.endsWith(`.${watch}`);
}

function trimUrl(raw: string): string {
  let url = raw;
  while (url.length > 0 && /[.,;:!?]$/.test(url)) url = url.slice(0, -1);
  while (url.endsWith(')') && (url.match(/\(/g) ?? []).length < (url.match(/\)/g) ?? []).length) {
    url = url.slice(0, -1);
  }
  while (url.endsWith(']') && (url.match(/\[/g) ?? []).length < (url.match(/\]/g) ?? []).length) {
    url = url.slice(0, -1);
  }
  return url;
}

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'\\]+/gi;

export function extractUrls(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(URL_RE)) {
    const url = trimUrl(match[0] ?? '');
    if (!url || seen.has(url) || !hostFromUrl(url)) continue;
    seen.add(url);
    found.push(url);
    if (found.length >= MAX_URLS) break;
  }
  return found;
}

function cleanDoi(raw: string): string | null {
  let doi = raw.trim();
  try {
    doi = decodeURIComponent(doi);
  } catch {
    // Keep the raw suffix when it is not valid percent-encoding.
  }
  doi = doi.replace(/^[^\d]*/, '');
  while (doi.length > 0 && /[.,;:!?)]$/.test(doi)) {
    if (doi.endsWith(')') && (doi.match(/\(/g) ?? []).length >= (doi.match(/\)/g) ?? []).length) break;
    doi = doi.slice(0, -1);
  }
  if (!/^10\.\d{4,9}\//.test(doi)) return null;
  return doi.toLowerCase();
}

const DOI_IN_TEXT = /10\.\d{4,9}\/[^\s<>"'\\]+/gi;
const DOI_PREFIX = /\bdoi:\s*(10\.\d{4,9}\/[^\s<>"'\\]+)/gi;

export function extractDois(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined): void => {
    if (!raw || found.length >= MAX_DOIS) return;
    const doi = cleanDoi(raw);
    if (!doi || seen.has(doi)) return;
    seen.add(doi);
    found.push(doi);
  };

  for (const url of extractUrls(text)) {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
    try {
      const parsed = new URL(withScheme);
      const host = normalizeHost(parsed.hostname);
      if (host === 'doi.org' || host === 'dx.doi.org') {
        const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, '').replace(/^doi\//i, '');
        add(path);
      }
    } catch {
      // Not a DOI link.
    }
  }
  for (const match of text.matchAll(DOI_PREFIX)) add(match[1]);
  for (const match of text.matchAll(DOI_IN_TEXT)) add(match[0]);
  return found;
}

export function hostsFromText(text: string): string[] {
  const hosts: string[] = [];
  const seen = new Set<string>();
  for (const url of extractUrls(text)) {
    const host = hostFromUrl(url);
    if (!host || host === 'doi.org' || host === 'dx.doi.org' || seen.has(host)) continue;
    seen.add(host);
    hosts.push(host);
  }
  return hosts;
}

export function parseAllowlist(raw: string | null | undefined): Allowlist {
  const domains: string[] = [];
  const names: string[] = [];
  // Missing setting uses the MDPI/Frontiers default. A blank setting is an intentional empty allowlist.
  const text = raw === null || raw === undefined ? DEFAULT_ALLOWLIST : raw;
  for (const part of text.split(/[,\n]/)) {
    const token = part.trim();
    if (!token) continue;
    if (token.includes('.') && !/\s/.test(token)) {
      const host = normalizeHost(token) ?? hostFromUrl(token);
      if (host) {
        domains.push(host);
        continue;
      }
    }
    names.push(token);
  }
  return { domains, names };
}

export function normalizePublisherName(name: string): string {
  return name.toLowerCase().replace(/&amp;/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Whole-word match so "Frontiers" hits "Frontiers Media SA" and not "frontiersman". */
export function publisherNamesMatch(haystack: string, needle: string): boolean {
  const left = normalizePublisherName(haystack);
  const right = normalizePublisherName(needle);
  if (!left || !right || right.length < 3) return false;
  if (left === right) return true;
  const escaped = right.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^| )${escaped}(?: |$)`).test(left);
}

export function isAllowlisted(domain: string | null, publisherName: string | null, allowlist: Allowlist): boolean {
  if (domain && allowlist.domains.some((entry) => domainMatches(domain, entry))) return true;
  if (publisherName && allowlist.names.some((entry) => publisherNamesMatch(publisherName, entry))) return true;
  return false;
}

function nameKeyFor(name: string): string | null {
  const normalized = normalizePublisherName(name);
  if (normalized.length < 3) return null;
  return `name:${normalized.replace(/ /g, '-')}`;
}

export function mergeHits(hits: JournalHit[]): JournalHit[] {
  const map = new Map<string, JournalHit>();
  for (const hit of hits) {
    const prev = map.get(hit.publisherKey);
    if (!prev) {
      map.set(hit.publisherKey, { ...hit });
      continue;
    }
    const lists = new Set(
      [...prev.sourceList.split(';'), ...hit.sourceList.split(';')].map((part) => part.trim()).filter(Boolean),
    );
    prev.sourceList = [...lists].join('; ');
    if (!prev.publisher && hit.publisher) prev.publisher = hit.publisher;
    if (!prev.nameKey && hit.nameKey) prev.nameKey = hit.nameKey;
    if (!prev.sourceUrl && hit.sourceUrl) prev.sourceUrl = hit.sourceUrl;
  }
  return [...map.values()];
}

export function matchHosts(hosts: string[], entries: WatchEntry[], allowlist: Allowlist): JournalHit[] {
  const hits: JournalHit[] = [];
  for (const candidate of hosts) {
    const host = normalizeHost(candidate) ?? hostFromUrl(candidate);
    if (!host) continue;
    const matched = entries.filter((entry) => domainMatches(host, entry.domain));
    if (matched.length === 0) continue;
    if (matched.some((entry) => isAllowlisted(entry.domain, entry.name, allowlist))) continue;
    if (isAllowlisted(host, null, allowlist)) continue;
    matched.sort((a, b) => a.domain.length - b.domain.length || a.domain.localeCompare(b.domain));
    const primary = matched[0];
    if (!primary) continue;
    const publisher = primary.name.trim() || primary.domain;
    const lists = [...new Set(matched.map((entry) => entry.sourceList).filter(Boolean))];
    hits.push({
      publisherKey: primary.domain,
      nameKey: nameKeyFor(publisher),
      publisher,
      sourceList: lists.join('; '),
      sourceUrl: primary.sourceUrl,
      domain: primary.domain,
    });
  }
  return mergeHits(hits);
}

/**
 * Weak secondary signal. Off unless predatoryWatchMatchPublisherName is enabled.
 * Requires a watchlist name of at least 6 characters and refuses ambiguous fan-out.
 */
export function matchPublisherNames(publisher: string | null, entries: WatchEntry[], allowlist: Allowlist): JournalHit[] {
  if (!publisher || !publisher.trim()) return [];
  if (isAllowlisted(null, publisher, allowlist)) return [];
  const matched = entries.filter((entry) => {
    const name = entry.name.trim();
    return normalizePublisherName(name).length >= 6
      && publisherNamesMatch(publisher, name)
      && !isAllowlisted(entry.domain, name, allowlist);
  });
  const byName = new Map<string, WatchEntry[]>();
  for (const entry of matched) {
    const key = nameKeyFor(entry.name);
    if (!key) continue;
    const group = byName.get(key) ?? [];
    group.push(entry);
    byName.set(key, group);
  }
  if (byName.size > 3) return [];
  const hits: JournalHit[] = [];
  for (const [key, group] of byName) {
    group.sort((a, b) => a.domain.length - b.domain.length || a.domain.localeCompare(b.domain));
    const primary = group[0];
    if (!primary) continue;
    const lists = [...new Set(group.map((entry) => entry.sourceList).filter(Boolean))];
    hits.push({
      publisherKey: key,
      nameKey: key,
      publisher: primary.name.trim() || publisher.trim(),
      sourceList: lists.join('; '),
      sourceUrl: primary.sourceUrl,
      domain: primary.domain,
    });
  }
  return hits;
}

export function matchPublication(
  hosts: string[],
  publisher: string | null,
  entries: WatchEntry[],
  allowlist: Allowlist,
  matchNames: boolean,
): JournalHit[] {
  const domainHits = matchHosts(hosts, entries, allowlist);
  if (!matchNames || !publisher) return domainHits;
  const claimedNames = new Set(domainHits.map((hit) => hit.nameKey).filter((key): key is string => !!key));
  const nameHits = matchPublisherNames(publisher, entries, allowlist)
    .filter((hit) => !claimedNames.has(hit.publisherKey));
  return mergeHits([...domainHits, ...nameHits]);
}

export function hitKeys(hit: JournalHit): string[] {
  return hit.nameKey && hit.nameKey !== hit.publisherKey ? [hit.publisherKey, hit.nameKey] : [hit.publisherKey];
}

/** Drop publishers already warned on this post. A claimed name key suppresses a later name-only hit. */
export function selectUnwarned(hits: JournalHit[], warned: Iterable<string>): JournalHit[] {
  const known = new Set(warned);
  return mergeHits(hits).filter((hit) => hitKeys(hit).every((key) => !known.has(key)));
}

export function renderWarning(template: string, hits: JournalHit[]): string {
  const text = template.trim();
  if (!text) return '';
  return mergeHits(hits).map((hit) => text
    .split('{publisher}').join(hit.publisher || hit.domain)
    .split('{source_list}').join(hit.sourceList)
    .split('{source list}').join(hit.sourceList)
    .split('{source_url}').join(hit.sourceUrl)).join('\n\n');
}

export function isAppAuthor(name: string | undefined, appUsername: string | undefined): boolean {
  if (!name || !appUsername) return false;
  return name.trim().toLowerCase() === appUsername.trim().toLowerCase();
}

export function warnedPublisherKey(postId: string, publisherKey: string): string {
  return `bot:pjmod:pub:${postId}:${publisherKey}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pushUrl(urls: string[], value: unknown): void {
  if (typeof value === 'string' && value.trim()) urls.push(value.trim());
}

function uniqueHosts(urls: string[]): string[] {
  const hosts: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const host = hostFromUrl(url);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    hosts.push(host);
  }
  return hosts;
}

/** Landing/resource hosts from a Crossref works message. ISSN and container titles are ignored. */
export function hostsFromCrossref(payload: unknown): ResolvedPublication {
  const root = isRecord(payload) ? payload : null;
  const message = root && isRecord(root.message) ? root.message : root;
  if (!message) return { hosts: [], publisher: null };
  const urls: string[] = [];
  pushUrl(urls, message.URL ?? message.url);
  if (Array.isArray(message.link)) {
    for (const link of message.link) {
      if (isRecord(link)) pushUrl(urls, link.URL ?? link.url);
    }
  }
  if (isRecord(message.resource) && isRecord(message.resource.primary)) {
    pushUrl(urls, message.resource.primary.URL ?? message.resource.primary.url);
  }
  const publisher = typeof message.publisher === 'string' ? message.publisher : null;
  return { hosts: uniqueHosts(urls), publisher };
}

export function hostsFromDatacite(payload: unknown): ResolvedPublication {
  const root = isRecord(payload) ? payload : null;
  const data = root && isRecord(root.data) ? root.data : null;
  const attributes = data && isRecord(data.attributes) ? data.attributes : null;
  if (!attributes) return { hosts: [], publisher: null };
  const urls: string[] = [];
  pushUrl(urls, attributes.url);
  let publisher: string | null = null;
  if (typeof attributes.publisher === 'string') publisher = attributes.publisher;
  else if (isRecord(attributes.publisher) && typeof attributes.publisher.name === 'string') {
    publisher = attributes.publisher.name;
  }
  return { hosts: uniqueHosts(urls), publisher };
}

export function registrationAgency(payload: unknown): 'crossref' | 'datacite' | null {
  const rows = Array.isArray(payload) ? payload : [payload];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const agency = String(row.RA ?? row.ra ?? '').toLowerCase();
    if (agency.includes('crossref')) return 'crossref';
    if (agency.includes('datacite')) return 'datacite';
  }
  return null;
}
