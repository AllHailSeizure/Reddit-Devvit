#!/usr/bin/env node
import { createInterface } from 'readline';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'llmphysics-bot/1.0 (Reddit bot; r/llmphysics)';
const DEFAULT_OUTPUT = 'src/server/command-modules/category-scores.json';
const RATE_LIMIT_MS = 250;

// ─── Flag parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { topic: null, depth: null, output: DEFAULT_OUTPUT, overwrite: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help')                           { args.help = true; }
    else if ((a === '-t' || a === '--topic')  && argv[i + 1])  { args.topic = argv[++i]; }
    else if ((a === '-d' || a === '--depth')  && argv[i + 1])  { args.depth = parseInt(argv[++i], 10); }
    else if ((a === '-o' || a === '--output') && argv[i + 1])  { args.output = argv[++i]; }
    else if (a === '--overwrite')                               { args.overwrite = true; }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: node scripts/build-category-db.mjs -t <topic> [options]

Options:
  -t, --topic <name>    Wikipedia category to expand, e.g. "Physics"  (required)
  -d, --depth <n>       Max recursion depth after top-level  (required)
  -o, --output <path>   Output JSON file  (default: ${DEFAULT_OUTPUT})
      --overwrite       Overwrite output instead of merging with existing
  -h, --help            Show this help
`);
}

// ─── Wikipedia API ────────────────────────────────────────────────────────────

async function fetchSubcategories(categoryTitle, attempt = 0) {
  const params = new URLSearchParams({
    action: 'query',
    list: 'categorymembers',
    cmtitle: categoryTitle,
    cmtype: 'subcat',
    cmlimit: '500',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`${WIKI_API}?${params}`, { headers: { 'User-Agent': USER_AGENT } });

  if (res.status === 429 && attempt < 4) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '0', 10);
    const wait = retryAfter > 0 ? retryAfter * 1000 : (2 ** attempt) * 1000;
    process.stdout.write(`\r  Rate limited — waiting ${wait / 1000}s...         `);
    await sleep(wait);
    return fetchSubcategories(categoryTitle, attempt + 1);
  }

  if (!res.ok) throw new Error(`API error ${res.status} for ${categoryTitle}`);
  const data = await res.json();
  return (data.query?.categorymembers ?? []).map(m => m.title);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Interactive prompts ──────────────────────────────────────────────────────

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// ─── BFS traversal ────────────────────────────────────────────────────────────

async function traverse(rootsWithScores, maxDepth) {
  const output = {};
  const visited = new Set();
  const queue = rootsWithScores.map(({ category, score }) => ({ category, score, depth: 0 }));
  let count = 0;

  while (queue.length > 0) {
    const { category, score, depth } = queue.shift();
    if (visited.has(category)) continue;
    visited.add(category);

    const existing = output[category];
    output[category] = {
      score: Math.max(existing?.score ?? 0, score),
      depth: Math.min(existing?.depth ?? depth, depth),
    };
    count++;

    if (count % 50 === 0) {
      process.stdout.write(`\r  Indexed ${count} categories...`);
    }

    if (depth < maxDepth) {
      await sleep(RATE_LIMIT_MS);
      try {
        const subcats = await fetchSubcategories(category);
        for (const sub of subcats) {
          if (!visited.has(sub)) {
            queue.push({ category: sub, score, depth: depth + 1 });
          }
        }
      } catch (err) {
        console.error(`\nWarning: failed to fetch subcategories of ${category}: ${err.message}`);
      }
    }
  }

  process.stdout.write(`\r  Indexed ${count} categories.   \n`);
  return output;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) { printHelp(); process.exit(0); }

  if (!args.topic) {
    console.error('Error: -t / --topic is required. Run with -h for help.');
    process.exit(1);
  }

  if (args.depth === null) {
    console.error('Error: -d / --depth is required. Run with -h for help.');
    process.exit(1);
  }

  const rootCategory = `Category:${args.topic}`;
  const outputPath = resolve(args.output);

  console.log(`\nFetching subcategories of ${rootCategory}...`);
  let subcats;
  try {
    subcats = await fetchSubcategories(rootCategory);
  } catch (err) {
    console.error(`Failed to fetch root category: ${err.message}`);
    process.exit(1);
  }

  if (subcats.length === 0) {
    console.log('No subcategories found. Check that the topic name matches a Wikipedia category.');
    process.exit(1);
  }

  const pad = String(subcats.length).length;
  console.log(`Found ${subcats.length} subcategories. Enter a score for each (1–10), or press Enter to skip.\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const rootsWithScores = [];

  for (let i = 0; i < subcats.length; i++) {
    const name = subcats[i].replace(/^Category:/, '');
    const prefix = `  ${String(i + 1).padStart(pad)}/${subcats.length}  `;
    const answer = await ask(rl, `${prefix}${name.padEnd(42)} Score: `);
    const score = parseInt(answer.trim(), 10);
    if (!isNaN(score) && score > 0) {
      rootsWithScores.push({ category: subcats[i], score });
    }
  }

  rl.close();

  if (rootsWithScores.length === 0) {
    console.log('\nNo subcategories scored. Nothing to write.');
    process.exit(0);
  }

  console.log(`\nTraversing ${rootsWithScores.length} scored subcategories to depth ${args.depth}...`);
  const newEntries = await traverse(rootsWithScores, args.depth);

  let existing = {};
  if (!args.overwrite && existsSync(outputPath)) {
    existing = JSON.parse(readFileSync(outputPath, 'utf8'));
  }

  for (const [cat, entry] of Object.entries(newEntries)) {
    const prev = existing[cat];
    existing[cat] = {
      score: Math.max(prev?.score ?? 0, entry.score),
      depth: Math.min(prev?.depth ?? entry.depth, entry.depth),
    };
  }

  const sorted = Object.fromEntries(
    Object.entries(existing).sort(([a], [b]) => a.localeCompare(b))
  );

  const json = JSON.stringify(sorted, null, 2);
  writeFileSync(outputPath, json, 'utf8');

  const sizeKB = Math.round(Buffer.byteLength(json, 'utf8') / 1024);
  console.log(`\nDone. Total entries: ${Object.keys(sorted).length}  |  File size: ${sizeKB} KB`);
  console.log(`Output: ${outputPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
