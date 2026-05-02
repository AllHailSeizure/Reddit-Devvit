import { reddit, settings } from '@devvit/web/server';
import { logger } from '../logger';
import { registerCommand } from '../trigger-modules/command';
import type { CommandEvent } from '../types';

const log = logger('define');

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_ARTICLE_BASE = 'https://en.wikipedia.org/wiki/';
const USER_AGENT = 'llmphysics-bot/1.0 (Reddit bot; r/llmphysics)';
const EXTRACT_MAX_CHARS = 600;
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

// ─── Types ────────────────────────────────────────────────────────────────────

type WikiPage = {
  pageid: number;
  title: string;
  extract: string;
};

// ─── Groq term resolver ───────────────────────────────────────────────────────

async function geminiResolve(term: string, apiKey: string): Promise<string | null> {
  const prompt =
    `You are a Wikipedia title resolver for a physics/mathematics/AI subreddit.\n` +
    `Given a user's search term, return the exact Wikipedia article title for the physics, ` +
    `mathematics, or artificial intelligence concept they're asking about. Correct any spelling ` +
    `errors and use proper Wikipedia title formatting (e.g. diacritics, capitalisation).\n` +
    `If the term is not a physics, mathematics, or AI concept, reply with exactly "none".\n` +
    `Reply with only the Wikipedia article title or "none" — nothing else.\n\n` +
    `Term: ${term}`;

  const res = await fetch(GEMINI_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 30, temperature: 0 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API ${res.status}`);
  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  const result = (data.candidates[0]?.content.parts[0]?.text ?? '').trim();
  return result.toLowerCase() === 'none' || result === '' ? null : result;
}

// ─── Wikipedia API ────────────────────────────────────────────────────────────

async function fetchPageByTitle(title: string): Promise<WikiPage | null> {
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'extracts',
    exintro: 'true',
    explaintext: 'true',
    redirects: '1',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`);
  const data = await res.json() as {
    query: {
      pages: Record<string, {
        pageid: number;
        title: string;
        extract?: string;
        missing?: string;
      }>;
    };
  };
  const page = Object.values(data.query.pages)[0];
  if (!page || 'missing' in page) return null;
  return { pageid: page.pageid, title: page.title, extract: page.extract ?? '' };
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

// ─── Command handler ──────────────────────────────────────────────────────────

registerCommand(
  { commandName: 'define', contentType: 'comment', requiresArgument: true },
  async (event: CommandEvent, argument: string | null) => {
    if (!('comment' in event) || !event.comment) return;
    const term = argument!;
    const commentId = event.comment.id as `t1_${string}`;

    log.info('Looking up definition', { term });

    const apiKey = (await settings.get<string>('geminiApiKey')) || undefined;
    if (!apiKey) {
      log.warn('Groq API key not configured');
      return;
    }

    let replyText: string;
    try {
      const canonicalTitle = await geminiResolve(term, apiKey);
      log.info('Groq resolved term', { term, canonicalTitle });

      if (!canonicalTitle) {
        replyText = `"${term}" doesn't appear to be a physics, mathematics, or AI concept.`;
      } else {
        const page = await fetchPageByTitle(canonicalTitle);
        if (page) {
          replyText = `**${page.title}**\n[Wikipedia](${articleUrl(page.title)})\n\n${truncate(page.extract)}`;
        } else {
          replyText = `Couldn't find a Wikipedia article for "${canonicalTitle}".`;
        }
      }
    } catch (err) {
      log.error('Define command error', err, { term });
      replyText = `Failed to look up "${term}" — please try again later.`;
    }

    const comment = await reddit.getCommentById(commentId);
    await comment.reply({ text: replyText });
    log.info('Definition reply posted', { term, commentId });
  },
);
