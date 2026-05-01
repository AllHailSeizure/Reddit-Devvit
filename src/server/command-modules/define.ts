import { reddit } from '@devvit/web/server';
import { logger } from '../logger';
import { registerCommand } from '../trigger-modules/command';
import type { CommandEvent } from '../types';
import categoryScores from './category-scores.json';

const log = logger('define');

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_ARTICLE_BASE = 'https://en.wikipedia.org/wiki/';
const USER_AGENT = 'llmphysics-bot/1.0 (Reddit bot; r/llmphysics)';
const EXTRACT_MAX_CHARS = 600;

// ─── Types ────────────────────────────────────────────────────────────────────

type WikiSearchResult = {
  pageid: number;
  title: string;
  snippet: string;
};

type WikiPage = {
  pageid: number;
  title: string;
  extract: string;
  categories: string[];
};

type WikiSuggestion = {
  title: string;
  url: string;
};

// ─── API functions ────────────────────────────────────────────────────────────

async function searchWikipedia(term: string): Promise<WikiSearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: term,
    srlimit: '10',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wikipedia search failed: ${res.status}`);
  const data = await res.json() as { query: { search: WikiSearchResult[] } };
  return data.query.search ?? [];
}

async function fetchPages(pageIds: number[]): Promise<WikiPage[]> {
  const params = new URLSearchParams({
    action: 'query',
    pageids: pageIds.join('|'),
    prop: 'extracts|categories',
    exintro: 'true',
    explaintext: 'true',
    cllimit: '50',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wikipedia page fetch failed: ${res.status}`);
  const data = await res.json() as {
    query: {
      pages: Record<string, {
        pageid: number;
        title: string;
        extract?: string;
        categories?: Array<{ title: string }>;
      }>;
    };
  };
  return Object.values(data.query.pages).map(p => ({
    pageid: p.pageid,
    title: p.title,
    extract: p.extract ?? '',
    categories: (p.categories ?? []).map(c => c.title),
  }));
}

async function suggestTerms(term: string): Promise<WikiSuggestion[]> {
  const params = new URLSearchParams({
    action: 'opensearch',
    search: term,
    limit: '3',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wikipedia opensearch failed: ${res.status}`);
  const [, titles, , urls] = await res.json() as [string, string[], string[], string[]];
  return (titles ?? []).map((title, i) => ({ title, url: urls[i] ?? `${WIKI_ARTICLE_BASE}${encodeURIComponent(title)}` }));
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

const SCORE_THRESHOLD = 1;
const scores = categoryScores as Record<string, { score: number; depth: number }>;

function pageScore(page: WikiPage): number {
  return Math.max(0, ...page.categories.map(c => scores[c]?.score ?? 0));
}

function passesThreshold(page: WikiPage): boolean {
  return pageScore(page) >= SCORE_THRESHOLD;
}

// ─── Reply helpers ────────────────────────────────────────────────────────────

function articleUrl(title: string): string {
  return `${WIKI_ARTICLE_BASE}${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function truncate(text: string): string {
  if (text.length <= EXTRACT_MAX_CHARS) return text;
  const cut = text.slice(0, EXTRACT_MAX_CHARS);
  const lastSentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  return lastSentence > EXTRACT_MAX_CHARS * 0.5
    ? cut.slice(0, lastSentence + 1)
    : cut.trimEnd() + '…';
}

function replyHighConfidence(page: WikiPage): string {
  return `**${page.title}**\n[Wikipedia](${articleUrl(page.title)})\n\n${truncate(page.extract)}`;
}

function replyLowConfidence(term: string, candidates: WikiPage[]): string {
  const links = candidates
    .slice(0, 3)
    .map(p => `- [${p.title}](${articleUrl(p.title)})`)
    .join('\n');
  return `No clear physics/math/AI article found for "${term}". Top results:\n${links}`;
}

function replyNoResults(term: string, suggestions: WikiSuggestion[]): string {
  if (suggestions.length === 0) return `No Wikipedia results found for "${term}".`;
  const links = suggestions.map(s => `- [${s.title}](${s.url})`).join('\n');
  return `No Wikipedia results found for "${term}". Did you mean:\n${links}`;
}

// ─── Command handler ──────────────────────────────────────────────────────────

registerCommand(
  { commandName: 'define', contentType: 'comment', requiresArgument: true },
  async (event: CommandEvent, argument: string | null) => {
    if (!('comment' in event) || !event.comment) return;
    const term = argument!;
    const commentId = event.comment.id as `t1_${string}`;

    log.info('Looking up definition', { term });

    let replyText: string;
    try {
      const searchResults = await searchWikipedia(term);

      if (searchResults.length === 0) {
        const suggestions = await suggestTerms(term);
        replyText = replyNoResults(term, suggestions);
      } else {
        const top = searchResults.slice(0, 5);
        const pages = await fetchPages(top.map(c => c.pageid));

        // Preserve search-rank order (Wikipedia's own relevance) for each page
        const rankOf = new Map(top.map((r, i) => [r.pageid, i]));
        const byRank = (a: WikiPage, b: WikiPage) =>
          (rankOf.get(a.pageid) ?? 99) - (rankOf.get(b.pageid) ?? 99);

        // 1. Exact title match that passes threshold → return full definition
        const exact = pages.find(p => p.title.toLowerCase() === term.toLowerCase());
        if (exact && passesThreshold(exact)) {
          replyText = replyHighConfidence(exact);
        } else {
          // 2. Similar terms that pass threshold, ordered by search rank
          const passing = pages.filter(passesThreshold).sort(byRank);
          replyText = passing.length > 0
            ? replyLowConfidence(term, passing.slice(0, 3))
            : replyNoResults(term, await suggestTerms(term));
        }
      }
    } catch (err) {
      log.error('Wikipedia API error', err, { term });
      replyText = `Failed to look up "${term}" — please try again later.`;
    }

    const comment = await reddit.getCommentById(commentId);
    await comment.reply({ text: replyText });
    log.info('Definition reply posted', { term, commentId });
  },
);
