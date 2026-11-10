/**
 * Pluggable watchlist sources.
 * To add a source: append a group (or a page on an existing group) and handle its
 * `kind` in parse.mjs parsePage(). Do not add Kscien, predatoryjournals.org,
 * or predatoryreports.org — those lists are out of scope for this warning.
 */
import { parsePage } from './parse.mjs';

export const RETRACTION_WATCH_SOURCE_URL = 'https://retractionwatch.com/the-retraction-watch-hijacked-journal-checker/';
export const BEALLS_SOURCE_URL = 'https://beallslist.net/';
export const RETRACTION_WATCH_CSV_URL = 'https://docs.google.com/spreadsheets/d/1ak985WGOgGbJRJbZFanoktAN_UFeExpE/export?format=csv';

const BLOCKED_SOURCE_MARKERS = ['kscien', 'predatoryjournals.org', 'predatoryreports.org'];

export const SOURCE_GROUPS = [
  {
    id: 'retraction-watch-hijacked',
    sourceList: 'Retraction Watch Hijacked Journal Checker',
    sourceUrl: RETRACTION_WATCH_SOURCE_URL,
    // A short or empty download must not deactivate the stored list.
    minRows: 100,
    pages: [
      {
        id: 'retraction-watch-csv',
        url: RETRACTION_WATCH_CSV_URL,
        kind: 'retraction-watch-csv',
        listType: 'hijacked',
      },
    ],
  },
  {
    id: 'bealls-list',
    sourceList: "Beall's List",
    sourceUrl: BEALLS_SOURCE_URL,
    minRows: 400,
    pages: [
      { id: 'bealls-publishers', url: 'https://beallslist.net/', kind: 'bealls-list', listType: 'publisher' },
      { id: 'bealls-standalone', url: 'https://beallslist.net/standalone-journals/', kind: 'bealls-list', listType: 'standalone' },
      { id: 'bealls-hijacked', url: 'https://beallslist.net/hijacked-journals/', kind: 'bealls-hijacked', listType: 'hijacked' },
    ],
  },
];

export function assertAllowedSource(url) {
  const lower = String(url).toLowerCase();
  if (BLOCKED_SOURCE_MARKERS.some((marker) => lower.includes(marker))) {
    throw new Error(`Refusing blocked watchlist source: ${url}`);
  }
}

export function parseSourcePage(page, body) {
  assertAllowedSource(page.url);
  return parsePage(page.kind, page.listType, body);
}

export { parsePage };
