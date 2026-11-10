/**
 * Pure parsers for predatory-watchlist sources. No network.
 * Add a source by teaching parsePage() a new kind and listing it in sources.mjs.
 * Never ingest Kscien, predatoryjournals.org, or predatoryreports.org.
 *
 * ISSN is not parsed. Hijacked journals copy legitimate ISSNs, so an ISSN
 * match would warn on the real journal. Retraction Watch rows use only the
 * hijacked URL column. Beall's hijacked tables use only the hijacker column.
 */

const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'net.uk',
  'com.au', 'net.au', 'org.au', 'edu.au',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp',
  'com.br', 'com.mx', 'gob.mx', 'co.za', 'ac.za', 'com.tr',
  'co.in', 'ac.in', 'com.cn', 'edu.cn', 'com.tw', 'com.hk',
  'co.kr', 'com.sg', 'com.ar', 'co.nz', 'org.nz', 'ac.nz',
  'com.ua', 'com.pl', 'com.pt', 'co.id', 'ac.id', 'com.my',
]);

const REFERENCE_SUFFIXES = [
  'beallslist.net',
  'beallslist.weebly.com',
  'wikipedia.org',
  'wikimedia.org',
  'archive.org',
  'doaj.org',
  'worldcat.org',
  'doi.org',
  'crossref.org',
  'datacite.org',
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'wordpress.org',
  'wordpress.com',
  'w.org',
  'schema.org',
  'w3.org',
  'gravatar.com',
  'flaticon.com',
  'googletagmanager.com',
  'reddit.com',
  'redd.it',
];

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

export function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

export function visibleText(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function isPublicSuffix(host) {
  return MULTI_PART_SUFFIXES.has(host);
}

export function normalizeDomain(raw) {
  if (!raw) return null;
  let host = String(raw).trim().toLowerCase().replace(/\.$/, '');
  if (host.startsWith('www.')) host = host.slice(4);
  if (!host.includes('.') || host.includes('..') || host.startsWith('.') || host.endsWith('.')) return null;
  if (!/^[a-z0-9.-]+$/.test(host) || isPublicSuffix(host)) return null;
  return host;
}

export function domainFromUrl(raw) {
  if (raw == null) return null;
  let value = decodeEntities(String(raw)).trim();
  if (!value || value.startsWith('#') || /^mailto:/i.test(value) || /^javascript:/i.test(value)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `http://${value}`;
  try {
    return normalizeDomain(new URL(value).hostname);
  } catch {
    return null;
  }
}

export function isReferenceHost(host) {
  const normalized = normalizeDomain(host) ?? String(host || '').trim().toLowerCase();
  if (!normalized) return false;
  return REFERENCE_SUFFIXES.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function columnIndex(header, pattern) {
  return header.findIndex((cell) => pattern.test(String(cell).trim()));
}

/**
 * Retraction Watch Hijacked Journal Checker CSV.
 * Uses only "URL (Hijacked)" and the hijacked title. Original URL and both ISSN columns are ignored.
 */
export function parseRetractionWatchCsv(csv) {
  const rows = parseCsv(csv);
  let headerAt = -1;
  let urlCol = -1;
  let titleCol = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const found = columnIndex(rows[i], /url\s*\(\s*hijacked\s*\)/i);
    if (found >= 0) {
      headerAt = i;
      urlCol = found;
      titleCol = columnIndex(rows[i], /hijacked journal title/i);
      break;
    }
  }
  if (headerAt < 0) return [];
  const entries = [];
  for (const row of rows.slice(headerAt + 1)) {
    const rawUrl = row[urlCol] ?? '';
    const domain = domainFromUrl(rawUrl.split(/\s+/)[0] ?? '');
    if (!domain || isReferenceHost(domain)) continue;
    const name = visibleText(titleCol >= 0 ? row[titleCol] ?? '' : '').slice(0, 300);
    entries.push({ domain, name, listType: 'hijacked' });
  }
  return dedupe(entries);
}

export function extractEntryContent(html) {
  const source = String(html);
  const start = source.search(/<div[^>]*class="[^"]*entry-content[^"]*"/i);
  if (start < 0) return source;
  const rest = source.slice(start);
  const end = rest.search(/<footer\b|id="colophon"|class="[^"]*site-footer/i);
  return end > 0 ? rest.slice(0, end) : rest;
}

function extractAnchors(html) {
  const anchors = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match = re.exec(html);
  while (match) {
    const domain = domainFromUrl(match[1]);
    anchors.push({
      href: match[1],
      domain,
      rawText: match[2],
      text: visibleText(match[2]).slice(0, 300),
    });
    match = re.exec(html);
  }
  return anchors;
}

function isAlternateAnchor(rawText) {
  const text = visibleText(rawText).toLowerCase().replace(/[.…]+$/g, '').replace(/[()]/g, '').trim();
  if (!text) return false;
  if (/^(also\s+)?(and\s+)?here$/.test(text)) return true;
  if (/^(old url|unsafe url|this url|mirror)$/.test(text)) return true;
  if (/^https?:\/\//.test(text)) return true;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(text);
}

/**
 * Beall's publishers and standalone-journal pages.
 * The first off-site link in each list item is the listed venue.
 * Later links are kept only when the anchor is an alternate ("here", "old url").
 * A later link whose anchor is a journal name is the legitimate title being hijacked, and is dropped.
 */
export function parseBeallsListHtml(html, listType) {
  const content = extractEntryContent(html);
  const entries = [];
  const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match = re.exec(content);
  while (match) {
    const anchors = extractAnchors(match[1]).filter((anchor) => anchor.domain && !isReferenceHost(anchor.domain));
    const kept = [];
    for (const anchor of anchors) {
      if (kept.length === 0 || isAlternateAnchor(anchor.rawText)) kept.push(anchor);
    }
    if (kept.length > 0) {
      const name = kept[0].text || visibleText(match[1]).slice(0, 300);
      for (const anchor of kept) entries.push({ domain: anchor.domain, name, listType });
    }
    match = re.exec(content);
  }
  return dedupe(entries);
}

/**
 * Beall's hijacked-journal tables. Only the first cell (hijacker) is read.
 * Every off-site link in that cell is a hijacker URL, including "here" alternates.
 */
export function parseBeallsHijackedHtml(html) {
  const content = extractEntryContent(html);
  const entries = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row = rowRe.exec(content);
  while (row) {
    const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells = [];
    let cell = cellRe.exec(row[1]);
    while (cell) {
      cells.push(cell[1]);
      cell = cellRe.exec(row[1]);
    }
    const first = cells[0] ?? '';
    const anchors = extractAnchors(first).filter((anchor) => anchor.domain && !isReferenceHost(anchor.domain));
    if (anchors.length > 0) {
      const name = anchors[0].text || visibleText(first).slice(0, 300);
      for (const anchor of anchors) entries.push({ domain: anchor.domain, name, listType: 'hijacked' });
    }
    row = rowRe.exec(content);
  }
  return dedupe(entries);
}

const LIST_RANK = { hijacked: 3, standalone: 2, publisher: 1 };

export function mergeRows(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row?.domain) continue;
    const prev = map.get(row.domain);
    const rank = LIST_RANK[row.listType] ?? 0;
    if (!prev || rank > (LIST_RANK[prev.listType] ?? 0)) {
      map.set(row.domain, { domain: row.domain, name: row.name || prev?.name || '', listType: row.listType });
    } else if (!prev.name && row.name) {
      prev.name = row.name;
    }
  }
  return [...map.values()];
}

function dedupe(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = `${row.listType}|${row.domain}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

export function parsePage(kind, listType, body) {
  if (kind === 'retraction-watch-csv') return parseRetractionWatchCsv(body);
  if (kind === 'bealls-list') return parseBeallsListHtml(body, listType);
  if (kind === 'bealls-hijacked') return parseBeallsHijackedHtml(body);
  throw new Error(`Unknown predatory-watchlist parser: ${kind}`);
}
