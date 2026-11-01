# moderator-toolbox

A modular Reddit moderation-assistance bot for [r/LLMPhysics](https://reddit.com/r/LLMPhysics), built on the [Devvit](https://developers.reddit.com/docs) platform.

**Version:** 2.15.2.1  
**Platform:** @devvit/web ^0.13.4  
**Subreddit:** r/LLMPhysics

---

## Overview

`moderator-toolbox` automates common moderation tasks for r/LLMPhysics. It enforces posting rules, handles comment chains, resolves physics/math terms via `!define`, and gives moderators menu-driven tools accessible directly from the Reddit UI.

AI-powered paper review (formerly this app's "Adversarial Reviewer" module) has moved to the standalone [`adversarial-review`](../adversarial-review/README.md) app.

The architecture is intentionally modular: each capability is a self-contained TypeScript file. Adding a new feature means creating one file and adding one line to `registry.ts` — the entry point and core dispatch logic never need to change.

Moderators and users interact with the bot through:
- Reddit's overflow (three-dot) menu on posts and comments
- `!command [argument]` syntax in posts or comments that mention `u/LLMPhysics-bot`

---

## Architecture

```
Reddit event
    │
    ▼
devvit.json → /internal/triggers/<event>
    │
    ▼
src/server/index.ts  (Hono route)
    │
    ▼  dispatch(registry.<TRIGGER_ARRAY>, event)
    │
    ├──▶ module A  run(event)   ← try/catch, errors logged, continues
    ├──▶ module B  run(event)
    └──▶ module C  run(event)
```

**Trigger modules** export `run(event)` and are registered in arrays in `registry.ts`. Each module is isolated — errors in one do not stop others.

**Action modules** (menu items) export `register(app: Hono)` and mount their own routes, registered once at startup inside `registerAll()`.

**Command modules** call `registerCommand()` at module scope and are imported as side-effects in `registry.ts`.

```
src/server/
├── index.ts                         Entry point; creates Hono app
├── registry.ts                      Registers all modules
├── types.ts                         Shared types
├── settings-registry.ts             All settings definitions
├── admin.ts                         Settings form handlers
├── trigger-modules/
│   ├── flood-moderator.ts           Post quota enforcement
│   ├── depth-cap-moderator.ts       Comment depth enforcement
│   ├── self-response-moderator.ts   OP self-reply enforcement
│   ├── nonresponder-check.ts        OP participation warning
│   ├── length-moderator.ts          Post length enforcement
│   └── report-moderator.ts          Bot-report ignorer
├── action-modules/
│   ├── mop-tool.ts                  Chain Mop
│   ├── response-tool.ts             Saved Responses
│   └── quota-viewer.ts              Flood Quota Checker
├── command-modules/
│   └── define-command.ts            !define command
└── helpers/
    ├── command-helper.ts            Command dispatch
    ├── redis-helper.ts              Flood status tracking
    ├── settings-helper.ts           Settings read/write
    └── log-helper.ts                Structured logger
```

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- Devvit CLI: `npm install -g devvit`
- A Reddit account with moderator access to your target subreddit
- A [Google Gemini API key](https://aistudio.google.com/) (required for the `!define` command)
- (Optional) A [Supabase](https://supabase.com/) project for writing structured bot logs

### Install dependencies

```bash
cd moderator-toolbox
npm install
```

### Build

```bash
npm run build
```

Runs `vite build`, compiling TypeScript into the dist bundle.

### Playtest (development)

```bash
npm run build
devvit playtest r/llmphysics_dev
```

Navigate to your dev subreddit with `?playtest=moderator-toolbox` appended to the URL. When posts open in new tabs, re-add the query parameter manually.

### Deploy to production

```bash
npm run build
devvit upload
```

Then install the app on your subreddit via the Devvit Developer Portal.

### Configure API keys

In the Devvit app settings panel (accessible via the subreddit's app settings), set:

| Setting key | Description |
|-------------|-------------|
| `geminiApiKey` | Google Gemini API key — required for `!define` term resolution |
| `supabaseUrl` | Supabase project URL — used for writing bot logs to the `bot_logs` table (optional) |
| `supabaseServiceKey` | Supabase service key for writing bot logs (optional). Keep secret |

---

## Trigger Modules

### Nonresponder Check

On post submit, checks the author's latest 2 qualifying previous posts here, within their 50 most recent posts across Reddit. Each needs at least 3 surviving comments from other known users: OP, the app account, missing/deleted authors, and removed/deleted/spam comments are excluded. Reddit's total comment count is only a cheap pre-filter. Removed, spam, and deleted posts are skipped; at most 10 candidate trees are fetched newest-first to find enough qualifying posts.

An OP response must be a surviving, non-spam reply to another eligible user's comment, at any depth. Top-level OP comments and replies to self or app accounts do not count. A removed/deleted parent still counts if its eligible author is known; missing parents and unknown/deleted parent authors do not. If no qualifying post has an OP response, the app posts a distinguished, stickied, locked warning on the new post with `botSignature`. Warnings have no repeat limit; the post stays open.

When every checked qualifying post was also warned, the app additionally reports the new post to moderators after posting its warning, with reason “Nonresponder: repeated warnings ignored”. `nonresponderReportRepeat` can disable reporting. Warning comment IDs are stored in `bot:nrmod:warned:{postId}` for 180 days. Without a tracking key, a distinguished comment by the app account starting with the current warning text counts as a previous warning. Changing that text or losing/removing older comments can prevent fallback detection after expiry. Report failures are logged; `bot:nrmod:log` records whether escalation was requested and reporting succeeded.

Moderators are exempt by default (`nonresponderRunOnMods=false`); approved users are checked by default (`nonresponderRunOnApprovedUsers=true`). For a moderator who is also approved, the moderator setting wins. Always skip missing/deleted posters and the app's own account; it is also excluded from other-user counts, reply parents, and used for warning detection. Other bots/apps are checked like anyone else, with exemptions only through moderator/approved status; there is no username list.

With `nonresponderSkipLockedComments=true` (default), locked comments (including AutoModerator, mod notices, or bots/apps) do not count toward the minimum, and OP replies to locked parents do not count as responses. Unlocked moderator comments count normally. A lock on OP's own reply does not matter: it counts if the reply survives and its parent is eligible. Turning this off lets locked comments and replies to them count, except app authors remain excluded.

Missing app identity, insufficient history, API failures, and incomplete comment scans produce no warning. Each tree is limited to 500 comments and 50 listings; hitting either limit skips enforcement. A seven-day atomic Redis claim prevents duplicate warning submissions within that window.

Settings are in the app installation settings (`devvit.json` → `settings.subreddit`):

| Key | Default |
|-----|---------|
| `nonresponderModEnabled` | `true` |
| `nonresponderPostsToCheck` | `2` (1–10) |
| `nonresponderMinComments` | `3` (1–100), other-user comments only |
| `nonresponderReportRepeat` | `true` |
| `nonresponderSkipLockedComments` | `true` |
| `nonresponderRunOnMods` | `false` |
| `nonresponderRunOnApprovedUsers` | `true` |
| `nonresponderResponse` | Responding to commenters is a subreddit rule. You did not respond on your recent qualifying posts. Please engage with the comments on this post by replying to commenters. |


Invalid numeric thresholds use defaults. A blank warning suppresses posting. Live testing should verify nested replies, removed/deleted comments, exemption settings, duplicate delivery, warning locking/stickying, report delivery, and warning tracking/fallback. Local decision tests: `npm test` (from `moderator-toolbox/`).

### Flood Moderator

**File:** `src/server/trigger-modules/flood-moderator.ts`  
**Triggers:** `onPostSubmit`, `onModAction`, `onPostDelete`

Enforces a per-user post quota using a rolling time window. When a user submits a post that exceeds their quota, the bot removes it and optionally posts a distinguished, stickied removal comment.

Every post is tracked in Redis regardless of whether enforcement fires. This tracking data is shared with the Quota Viewer and the bingo app.

**Removal logic:**
1. On `onPostSubmit`, the post is tracked in Redis and the user's mod/contributor status is stored
2. The quota is evaluated using the user's recent posts in the window; bot-removed, mod-removed, deleted, or exempt users can be excluded
3. If quota is exceeded, the post is removed and a comment is posted
4. `onModAction` updates the hash flag when a mod removes a post (`isModRemoved`)
5. `onPostDelete` updates the hash flag when the author deletes a post (`isUserDeleted`)

**Redis keys:**
- `flood:post:{postId}` — Hash: `userId`, `createdAt`, `isModerator`, `isApprovedUser`, `isUserDeleted`, `isModRemoved`, `isAutoRemoved`
- `flood:posts` — Global sorted set, score = creation timestamp
- `bot:flood:handled:{postId}` — Dedup key, TTL 1 hour

**Settings:**

| Key | Default | Description |
|-----|---------|-------------|
| `floodModEnabled` | `true` | Enable/disable (tracking still runs when disabled) |
| `floodAssistantMaxPosts` | `1` | Max posts per window |
| `floodAssistantWindowHours` | `24` | Rolling window in hours |
| `floodAssistantIgnoreModerators` | `true` | Exempt moderators from quota |
| `floodAssistantIgnoreContributors` | `true` | Exempt approved submitters from quota |
| `floodAssistantIgnoreAutoRemoved` | `true` | Don't count bot-removed posts |
| `floodAssistantIgnoreRemoved` | `true` | Don't count mod-removed posts |
| `floodAssistantIgnoreDeleted` | `true` | Don't count user-deleted posts |
| `floodAssistantResponse` | `''` | Removal comment text (leave blank for silent removal) |

---

### Depth Cap Moderator

**File:** `src/server/trigger-modules/depth-cap-moderator.ts`  
**Trigger:** `onCommentCreate`

Locks comment chains that reach the configured maximum depth. When a comment at the depth cap is created, the bot replies with a notice (distinguished and locked), locks the triggering comment, and files a report on it.

Depth is measured by walking `parentId` links upward until a post ID (`t3_`) is found. A comment directly on a post is depth 1.

**Redis keys:**
- `bot:dcmod:handled:{commentId}` — Dedup key, TTL 1 hour
- `bot:chainmod:depth-log` — Audit log, capped at 200 entries

**Settings:**

| Key | Default | Description |
|-----|---------|-------------|
| `depthCapModEnabled` | `true` | Enable/disable |
| `depthCap` | `10` | Maximum comment depth |
| `depthCapIgnoreModerators` | `true` | Exempt moderators |
| `depthCapIgnoreContributors` | `true` | Exempt approved submitters |
| `depthCapResponse` | `''` | Notice text (uses a generic fallback if blank) |
| `depthCapReport` | `true` | Submit the triggered comment as a report to the mod queue; disable to prevent queue clogging |

---

### Self-Response Moderator

**File:** `src/server/trigger-modules/self-response-moderator.ts`  
**Trigger:** `onCommentCreate`

Removes and locks top-level comments where the commenter is the original post author. Only fires on direct replies to the post (depth 1) — replies within threads are not affected.

**Redis keys:**
- `bot:srmod:handled:{commentId}` — Dedup key, TTL 1 hour
- `bot:srmod:log` — Audit log, capped at 200 entries

**Settings:**

| Key | Default | Description |
|-----|---------|-------------|
| `selfResponseModEnabled` | `true` | Enable/disable |
| `selfResponseIgnoreModerators` | `true` | Exempt moderators |
| `selfResponseIgnoreContributors` | `true` | Exempt approved submitters |
| `selfResponseResponse` | `''` | Notice text (leave blank for silent removal) |

---

### Length Moderator

**File:** `src/server/trigger-modules/length-moderator.ts`  
**Triggers:** `onPostSubmit`, `onPostFlairUpdate`

Enforces two post length rules:

1. **Max unhosted length** — Posts with a specific flair template ID are removed if the body (whitespace-excluded) exceeds the configured character limit.
2. **Min hosted length** — Posts containing a URL are removed if the body is shorter than the configured minimum (enforces a summary requirement for link posts).

The flair-update trigger uses a separate dedup key so a post that passes on submit can still be caught if a moderator applies the restricted flair later.

**Settings:**

| Key | Default | Description |
|-----|---------|-------------|
| `lengthModEnabled` | `true` | Enable/disable |
| `lengthModFlairId` | `''` | Flair template ID that triggers max-length enforcement |
| `lengthModMaxUnhostedLength` | `0` | Character cap for flaired posts (0 = disabled) |
| `lengthModMinHostedLength` | `0` | Min chars for link posts (0 = disabled) |
| `lengthModMaxUnhostedComment` | `''` | Removal notice for posts exceeding max length |
| `lengthModMinHostedComment` | `''` | Removal notice for link posts below min length |

---

### Report Moderator

**File:** `src/server/trigger-modules/report-moderator.ts`  
**Triggers:** `onCommentReport`, `onPostReport`

Silently ignores reports on content authored by known bot accounts (`AutoModerator`, `FloodAssistant`, `LLMPhysics-ModTeam`, `llmphysics-bot`). This keeps bot moderation notices out of the mod report queue.

No configurable settings.

---

### Flair Transfer

**File:** `src/server/trigger-modules/flair-transfer.ts`  
**Triggers:** `onPostFlairUpdate`

Counts posts whose new flair matches a configured post flair template ID and awards a configured user flair template ID once the same author reaches the configured threshold.

This module starts fresh from deployment onward. Each qualifying post is counted once permanently through a dedupe key, and each user's progress record is stored in Redis without expiry. Moderators are exempt. If user-flair application fails, the module queues a retry for the scheduler to attempt again 5 minutes later.

**Redis keys:**
- `flair-transfer:post:{postId}` â€” Permanent dedupe key for counted qualifying posts
- `flair-transfer:user:{userId}` â€” Persistent per-user progress record
- `flair-transfer:retry-queue` â€” Sorted set of pending award retries

**Settings:**

| Key | Default | Description |
|-----|---------|-------------|
| `flairTransferEnabled` | `true` | Enable/disable |
| `flairTransferPostFlairTemplateId` | `''` | Post flair template ID that counts toward the award |
| `flairTransferUserFlairTemplateId` | `''` | User flair template ID to award at threshold |
| `flairTransferRequiredPostCount` | `1` | Number of qualifying posts required for the award |
| `flairTransferOverwriteExistingUserFlair` | `false` | Allow replacing a non-empty existing user flair |

---

## Action Modules (Menu Items)

### Chain Mop

**File:** `src/server/action-modules/mop-tool.ts`  
**Menu location:** Comment

Recursively removes and/or locks an entire comment subtree starting from the selected comment. Actions are applied deepest-first (post-order traversal).

A confirmation form lets the moderator choose: Remove, Lock, and/or Skip distinguished comments. Both actions can be applied simultaneously.

After removal, a Reddit removal note is attached to the root comment recording the moderator's name and the count removed.

**Redis keys:**
- `bot:chainmod:session:{username}` — Session data, TTL 5 min
- `bot:chainmod:log` — Audit log, capped at 200 entries

**Settings:**

| Key | Default | Description |
|-----|---------|-------------|
| `mopToolEnabled` | `true` | Enable/disable |

---

### Saved Responses

**File:** `src/server/action-modules/response-tool.ts`  
**Menu location:** Post and Comment

A library of templated moderation messages that can be applied to posts or comments. Create responses once; they're available from any menu going forward.

**Apply flow:** Menu → select response → confirm/edit message + options → post.

**Options when applying:**
- Post as **Bot** or **Moderator (you)**
- **Distinguish** comment (bot-posted only)
- **Lock** the target post or comment

**Manage flow (subreddit menu):** Choose New, Edit, or Delete.

**Template macros** (expanded at send time):

| Macro | Expands to |
|-------|-----------|
| `{get_username}` | `u/AuthorName` of the target |
| `{get_post_flair}` | Flair text of the post |
| `{modmail}` | Markdown link to subreddit modmail |

Responses have a `location` property (`both` / `post` / `comment`) that controls where they appear in menus.

**Redis keys:**
- `bot:savedresponses` — All saved responses (JSON array)
- `bot:savedresponses:log` — Audit log, capped at 200 entries
- `bot:savedresponses:apply:{username}` — Apply session, TTL 5 min
- `bot:savedresponses:edit:{username}` — Edit session, TTL 5 min

**Settings:**

| Key | Default | Description |
|-----|---------|-------------|
| `responseToolEnabled` | `true` | Enable/disable |

---

### Flood Quota Checker

**File:** `src/server/action-modules/quota-viewer.ts`  
**Menu location:** Subreddit

Lets moderators look up any user's current post quota status. Shows each tracked post, whether it counts toward the quota, and when the user's next posting slot opens.

**Flow:** Subreddit menu → Flood Quota Checker → enter username → view results → search again.

Requires the Flood Moderator to be enabled.

---

### Bot Settings

**File:** `src/server/admin.ts`  
**Menu location:** Subreddit (multiple items)

Five settings menu groups, each a separate subreddit menu item:

| Menu item | Settings |
|-----------|---------|
| Bot Settings: Modules | Enable/disable each module |
| Bot Settings: Flood | Quota limits and exemption flags |
| Bot Settings: Commenting | Depth cap limits and self-response flags |
| Bot Settings: Posting | Length moderator limits |
| Bot Settings: Removal Messages | Bot signature and all removal comment templates |

Settings are stored in Redis as `settings:{key}` string values.

---

## Commands

Commands are triggered by mentioning `u/LLMPhysics-bot` in a post or comment, followed by `!commandName` or `!commandName [argument]`.

**Syntax:**
```
u/LLMPhysics-bot !commandName
u/LLMPhysics-bot !commandName [argument]
```

Multiple commands can appear in a single post or comment and are all dispatched in order. The bot mention is case-insensitive; command names are case-sensitive.

### !define [term]

**File:** `src/server/command-modules/define-command.ts`  
**Content type:** Comment only  
**Requires argument:** Yes (`!define [term]`)

Looks up a physics, math, or AI term on Wikipedia and replies with a summary. The lookup flow:

1. Gemini resolves the user's search term to a canonical Wikipedia article title, applying physics-specific disambiguation (e.g., returns "Observer effect (physics)" not "Observer effect") and correcting spelling errors
2. The Wikipedia API fetches the article intro
3. The bot replies with the article title, a link to Wikipedia, and up to ~600 characters of the intro

If Gemini 2.5 Flash Lite is rate-limited (HTTP 429), the command falls back to Gemini 3.1 Flash Lite.

**Settings:**

| Key | Default | Description |
|-----|---------|-------------|
| `defineCommandEnabled` | `true` | Enable/disable |
| `defineCommandCategory` | `'physics, mathematics, and AI'` | Subject category used for Gemini disambiguation |
| `defineCommandSearchGrounding` | `true` | Use Google Search grounding in Gemini resolution |
| `geminiApiKey` | — | Required |

---

## All Settings Reference

| Key | Module | Type | Default |
|-----|--------|------|---------|
| `botSignature` | Global | string | `'I am a bot...'` |
| `floodModEnabled` | Flood | boolean | `true` |
| `floodAssistantMaxPosts` | Flood | number | `1` |
| `floodAssistantWindowHours` | Flood | number | `24` |
| `floodAssistantIgnoreModerators` | Flood | boolean | `true` |
| `floodAssistantIgnoreContributors` | Flood | boolean | `true` |
| `floodAssistantIgnoreAutoRemoved` | Flood | boolean | `true` |
| `floodAssistantIgnoreRemoved` | Flood | boolean | `true` |
| `floodAssistantIgnoreDeleted` | Flood | boolean | `true` |
| `floodAssistantResponse` | Flood | string | `''` |
| `depthCapModEnabled` | Depth Cap | boolean | `true` |
| `depthCap` | Depth Cap | number | `10` |
| `depthCapIgnoreModerators` | Depth Cap | boolean | `true` |
| `depthCapIgnoreContributors` | Depth Cap | boolean | `true` |
| `depthCapResponse` | Depth Cap | string | `''` |
| `depthCapReport` | Depth Cap | boolean | `true` |
| `selfResponseModEnabled` | Self-Response | boolean | `true` |
| `selfResponseIgnoreModerators` | Self-Response | boolean | `true` |
| `selfResponseIgnoreContributors` | Self-Response | boolean | `true` |
| `selfResponseResponse` | Self-Response | string | `''` |
| `lengthModEnabled` | Length | boolean | `true` |
| `lengthModFlairId` | Length | string | `''` |
| `lengthModMaxUnhostedLength` | Length | number | `0` |
| `lengthModMinHostedLength` | Length | number | `0` |
| `lengthModMaxUnhostedComment` | Length | string | `''` |
| `lengthModMinHostedComment` | Length | string | `''` |
| `flairTransferEnabled` | Flair Transfer | boolean | `true` |
| `flairTransferPostFlairTemplateId` | Flair Transfer | string | `''` |
| `flairTransferUserFlairTemplateId` | Flair Transfer | string | `''` |
| `flairTransferRequiredPostCount` | Flair Transfer | number | `1` |
| `flairTransferOverwriteExistingUserFlair` | Flair Transfer | boolean | `false` |
| `mopToolEnabled` | Chain Mop | boolean | `true` |
| `responseToolEnabled` | Saved Responses | boolean | `true` |
| `defineCommandEnabled` | !define | boolean | `true` |
| `geminiApiKey` | !define | string | — |
| `supabaseUrl` | Bot logs | string | — |
| `supabaseServiceKey` | Bot logs | string | — |

### Bot Signature

The `botSignature` setting (under Bot Settings: Removal Messages) appends a formatted signature to all bot-generated comments. Each word is wrapped in Reddit's `^word` superscript syntax, preceded by a horizontal rule.

Example: setting `"I am a bot"` produces:

```
---

^I ^am ^a ^bot
```

Leave blank to post removal messages with no signature.

---

## Developer Guide

### Adding a Trigger Module

1. Create `src/server/trigger-modules/my-module.ts`:

```typescript
import type { OnPostSubmitRequest } from '@devvit/web/shared';
import { logger } from '../helpers/log-helper';

const log = logger('my-module');

export async function run(event: OnPostSubmitRequest): Promise<void> {
  // your logic
}
```

2. Add two lines to `src/server/registry.ts`:

```typescript
// At the top, with other imports:
import { run as myModule } from './trigger-modules/my-module';

// In the appropriate trigger array:
const POST_SUBMIT: PostSubmitHandler[] = [...existing, myModule];
```

### Adding a Menu Action Module

1. Create `src/server/action-modules/my-action.ts`:

```typescript
import type { Hono } from 'hono';

export function register(app: Hono): void {
  app.post('/internal/menu/my-action', async (c) => {
    // handler
  });
}
```

2. In `src/server/registry.ts`, import it and call inside `registerAll()`:

```typescript
import { register as registerMyAction } from './action-modules/my-action';
// inside registerAll():
registerMyAction(app);
```

3. Declare the menu item in `devvit.json`.

### Adding a Command Module

1. Create `src/server/command-modules/my-command.ts`:

```typescript
import { registerCommand } from '../helpers/command-helper';

registerCommand(
  { commandName: 'mycommand', contentType: 'comment', requiresArgument: true },
  async (event, argument) => {
    // argument is the string inside [brackets], or null
  }
);
```

2. Add a side-effect import in `src/server/registry.ts`:

```typescript
import './command-modules/my-command';
```

### Logger

```typescript
import { logger } from './helpers/log-helper';
const log = logger('my-module'); // call once at module scope

log.info('event happened', { postId });
log.warn('something looks off');
log.error('API call failed', err, { postId });
```

Output goes to `console` and Redis sorted sets (`bot:log:info`, `bot:log:warn`, `bot:log:error`), capped at 500 entries per level.

### Build & Deploy Cycle

```bash
npm run build                    # compile TypeScript
devvit playtest r/llmphysics_dev # upload + stream logs
devvit upload                    # deploy to production
```

### Common Mistakes

- Forgetting `npm run build` before `devvit playtest` — the CLI uploads `dist/`, not source
- Navigating to the subreddit without `?playtest=moderator-toolbox` in the URL — you'll see the production version
- Registering a command handler inside an async function — `registerCommand` must run at module scope before any events fire
- Using uppercase in command names — command lookup is case-sensitive

---

Created by u/AllHailSeizure for r/LLMPhysics.
