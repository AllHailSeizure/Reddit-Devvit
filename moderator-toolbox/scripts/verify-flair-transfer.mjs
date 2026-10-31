#!/usr/bin/env node
/**
 * Automated verification for flair-transfer.
 *
 * FIRST RUN:
 *   node scripts/verify-flair-transfer.mjs --list-post-flairs
 *   node scripts/verify-flair-transfer.mjs --list-user-flairs
 *
 * PORTAL SETUP (required before --auto):
 *   flairTransferEnabled                    = true
 *   flairTransferPostFlairTemplateId        = <uuid from --list-post-flairs>
 *   flairTransferUserFlairTemplateId        = <uuid from --list-user-flairs>
 *   flairTransferRequiredPostCount          = 1
 *   flairTransferOverwriteExistingUserFlair = false
 *
 * RUN:
 *   node scripts/verify-flair-transfer.mjs --auto --post-flair=<uuid> --user-flair=<uuid>
 *
 * Optional settings tests:
 *   --test2  (flairTransferEnabled = false)
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';

function loadToken() {
  const raw = readFileSync(`${homedir()}/.devvit/token`, 'utf8');
  const outer = JSON.parse(raw);
  const inner = JSON.parse(Buffer.from(outer.token, 'base64').toString('utf8'));
  return inner.accessToken;
}

const TOKEN = loadToken();
const UA = 'moderator-toolbox-verify/1.0 (by AllHailSeizure)';
const SUBREDDIT = 'llmphysics_dev';
const BOT_WAIT_MS = 8000;
const created = [];

async function reddit(method, path, body) {
  const url = `https://oauth.reddit.com${path}`;
  const opts = { method, headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': UA } };
  if (body) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = new URLSearchParams(body).toString();
  }
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Reddit API ${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getCurrentUsername() {
  const data = await reddit('GET', '/api/v1/me');
  return data.name;
}

async function getPostFlairs() {
  const data = await reddit('GET', `/r/${SUBREDDIT}/api/link_flair_v2`);
  return Array.isArray(data) ? data : [];
}

async function getUserFlairs() {
  const data = await reddit('GET', `/r/${SUBREDDIT}/api/user_flair_v2`);
  return Array.isArray(data) ? data : [];
}

async function submitPost(title, bodyText) {
  const data = await reddit('POST', '/api/submit', {
    api_type: 'json',
    kind: 'self',
    sr: SUBREDDIT,
    title: `[verify-flair-transfer] ${title} ${Date.now()}`,
    text: bodyText,
    resubmit: 'true',
  });
  const id = data.json?.data?.id;
  if (!id) throw new Error(`submitPost failed: ${JSON.stringify(data)}`);
  const fullname = `t3_${id}`;
  created.push(fullname);
  return fullname;
}

async function selectFlair(postFullname, flairId) {
  await reddit('POST', `/r/${SUBREDDIT}/api/selectflair`, {
    link: postFullname,
    flair_template_id: flairId,
  });
}

async function getPost(fullname) {
  const data = await reddit('GET', `/api/info?id=${fullname}`);
  return data.data?.children?.[0]?.data;
}

async function deleteCreated() {
  if (created.length === 0) return;
  process.stdout.write(`\nCleaning up ${created.length} created post(s)...`);
  for (const id of [...created].reverse()) {
    try {
      await reddit('POST', '/api/del', { id });
    } catch {
      // best-effort cleanup
    }
  }
  console.log(' done.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log('PASS');
    passed++;
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    failed++;
  }
}

function printFlairs(kind, flairs) {
  console.log(`\nAvailable ${kind} flair templates for r/${SUBREDDIT}:\n`);
  if (flairs.length === 0) {
    console.log('  (none configured)');
    return;
  }
  for (const flair of flairs) {
    console.log(`  ID:   ${flair.id}`);
    console.log(`  Text: ${flair.text || '(blank)'}`);
    console.log();
  }
}

async function main() {
  const LIST_POST_FLAIRS = process.argv.includes('--list-post-flairs');
  const LIST_USER_FLAIRS = process.argv.includes('--list-user-flairs');
  const AUTO = process.argv.includes('--auto');
  const TEST2 = process.argv.includes('--test2');
  const SINGLE_TEST = TEST2;

  const postFlairArg = process.argv.find((arg) => arg.startsWith('--post-flair='));
  const userFlairArg = process.argv.find((arg) => arg.startsWith('--user-flair='));
  const POST_FLAIR_ID = postFlairArg ? postFlairArg.split('=')[1] : null;
  const USER_FLAIR_ID = userFlairArg ? userFlairArg.split('=')[1] : null;

  if (LIST_POST_FLAIRS) {
    printFlairs('post', await getPostFlairs());
    return;
  }

  if (LIST_USER_FLAIRS) {
    printFlairs('user', await getUserFlairs());
    return;
  }

  if (!SINGLE_TEST && (!POST_FLAIR_ID || !USER_FLAIR_ID)) {
    console.log('\nERROR: --post-flair=<uuid> and --user-flair=<uuid> are required.\n');
    console.log('  node scripts/verify-flair-transfer.mjs --list-post-flairs');
    console.log('  node scripts/verify-flair-transfer.mjs --list-user-flairs');
    process.exitCode = 1;
    return;
  }

  const username = await getCurrentUsername();

  console.log('\n=== flair-transfer verification ===\n');
  console.log('PRE-CONDITIONS:');
  console.log('  - devvit playtest r/llmphysics_dev is running');
  console.log('  - flairTransferEnabled = true');
  if (POST_FLAIR_ID) console.log(`  - flairTransferPostFlairTemplateId = ${POST_FLAIR_ID}`);
  if (USER_FLAIR_ID) console.log(`  - flairTransferUserFlairTemplateId = ${USER_FLAIR_ID}`);
  console.log('  - flairTransferRequiredPostCount = 1');
  console.log('  - flairTransferOverwriteExistingUserFlair = false');
  console.log(`  - ${username} should start without the target user flair\n`);

  if (SINGLE_TEST) {
    console.log('  1. Award after flair update -> user flair applied ... SKIP (single-test mode)');
  } else await test('1. Award after flair update -> user flair applied', async () => {
    const post = await submitPost('award-on-flair-update', 'Automated flair-transfer verification body.');
    await selectFlair(post, POST_FLAIR_ID);
    await sleep(BOT_WAIT_MS);

    const data = await getPost(post);
    assert(data, 'post data not found');
    assert(
      data.author_flair_template_id === USER_FLAIR_ID,
      `expected author_flair_template_id=${USER_FLAIR_ID}, got ${data.author_flair_template_id}`,
    );
  });

  if (AUTO) {
    console.log('  2. Module disabled -> no award ... SKIP (--auto)');
  } else if (SINGLE_TEST && !TEST2) {
    // no-op
  } else await test('2. Module disabled -> no award', async () => {
    const post = await submitPost('disabled-no-award', 'Automated flair-transfer verification body.');
    await selectFlair(post, POST_FLAIR_ID);
    await sleep(BOT_WAIT_MS);

    const data = await getPost(post);
    assert(data, 'post data not found');
    assert(
      data.author_flair_template_id !== USER_FLAIR_ID,
      'target user flair should not be applied while module is disabled',
    );
  });

  console.log(`\n${'='.repeat(44)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('\nAll run tests PASSED');
    if (AUTO) {
      console.log('\nInteractive tests remaining:');
      console.log('  Set flairTransferEnabled = false -> node scripts/verify-flair-transfer.mjs --test2 --post-flair=' + POST_FLAIR_ID + ' --user-flair=' + USER_FLAIR_ID);
      console.log('  Manually verify dedupe by applying the same source flair twice to one post while flairTransferRequiredPostCount = 2.');
      console.log('  Manually verify overwrite behavior by giving the author another user flair before threshold and toggling flairTransferOverwriteExistingUserFlair.');
    }
  } else {
    console.log('\nSome tests FAILED - diagnose before promoting.');
    process.exitCode = 1;
  }

  await deleteCreated();
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  await deleteCreated();
  process.exitCode = 1;
}
