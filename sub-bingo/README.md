# sub-bingo

A community bingo game for [r/LLMPhysics](https://reddit.com/r/LLMPhysics), built on the [Devvit](https://developers.reddit.com/docs) platform. Players each receive a unique 5×5 bingo card populated with subreddit-specific "events" — tiles that trigger when the community does the things they always do.

**Version:** 1.0.0  
**Platform:** @devvit/web ^0.13.4  
**Subreddit:** r/LLMPhysics

---

## Overview

Each bingo game is tied to a Reddit post. When the game is created, each user who opens the post gets their own randomized 5×5 bingo card. Tile validation is **fully deterministic** — hand-written matcher functions in `deterministic-tiles.ts` watch the post's comments, reports, and mod actions, with no LLM in the loop. Winners are announced automatically by a scheduled job.

The game state is entirely stored in Redis and is scoped to a game ID (the post ID). Events accumulate in a sorted set; an hourly batch validator processes them and marks tiles.

---

## Architecture

```
Reddit event (comment, report, mod action)
    │
    ▼
/internal/triggers/<event>
    │
    ▼
bingo.ts: capture*Event(event)
    │  appends to bot:bingo:game:{gameId}:events
    ▼
SCHEDULER (hourly — devvit.json scheduler.tasks["bingo-batch-check"])
    │
    ├──▶ validator.ts: runBatchValidation(gameId)
    │        reads all events, evaluates every TILE_VALIDATORS.validate() against them
    │        marks triggered tiles in Redis; records first-trigger time + attribution
    │
    └──▶ bingo.ts: announceWinners()
             checks all cards for win condition
             posts bingo/full-card announcement comments
```

**Tile validation** is not event-driven; all pending events for the game are re-evaluated together each scheduler cycle via plain matcher functions (regex/heuristic checks over accumulated comment/post/report/mod-action counts) — see `deterministic-tiles.ts`.

**Moderator tooling** (stats, settings, live testing, historical simulation) is served over `/api/bingo/*` routes and consumed by the game's own in-post webview UI — there is no separate Devvit settings menu for this app.

```
src/server/
├── index.ts                 Routes: triggers, scheduler, menu items, API endpoints
├── bingo.ts                 Game logic: card generation, win checking, winner announcement, mod API handlers
├── tiles.ts                 TILE_VALIDATORS: 33 TileValidatorDefinition objects
├── deterministic-tiles.ts   The actual validate()/attribute() matcher functions per tile
├── validator.ts             Batch validation orchestration (deterministic, no external API)
├── pacing.ts                Monte Carlo win-time estimation used by the mod stats panel
├── simulation.ts            Fetches 7 days of real subreddit history to test tile pacing
└── settings.ts              readSetting / writeSetting helpers + defaults
```

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- Devvit CLI: `npm install -g devvit`
- A Reddit account with moderator access to your subreddit

No external API key is required — tile validation is fully deterministic.

### Install dependencies

```bash
cd sub-bingo
npm install
```

### Build

```bash
npm run build
```

Runs `vite build`.

### Playtest

```bash
npm run build
devvit playtest r/llmphysics_dev
```

### Deploy

```bash
npm run build
devvit upload
```

Then install on your subreddit via the Devvit Developer Portal.

---

## Game Lifecycle

1. A moderator opens the subreddit menu and selects **Create Bingo Post**
2. A Reddit Custom Post is created; the post ID becomes `gameId`, stored (with the start timestamp) in `bot:bingo:current-game`
3. When a user opens the post, the app checks for their card. If none exists, it generates one and stores it in Redis
4. Community events (comments, reports, mod actions) are captured and appended to the event log
5. Each cron cycle, `runBatchValidation` processes all pending events and marks tiles
6. `announceWinners` checks all cards. First user to complete a row/column/diagonal gets a "Bingo!" comment. First user to complete the entire card gets a "Full Card!" comment
7. The game runs until it expires (8 days TTL)

---

## Card Generation

`generateCard()` (called from `getBingoState` the first time a user opens the post):

1. Takes the pool of 33 tiles (`TILE_VALIDATORS`)
2. Shuffles the pool
3. Selects the first 24 tiles
4. Inserts the FREE square at index 12 (center of the 5×5 grid)
5. Serializes the card to Redis: `bot:bingo:card:{gameId}:{userId}`

Each user's card is randomized independently — no two cards are the same unless by coincidence.

---

## Tile Validation

**Files:** `src/server/validator.ts`, `src/server/deterministic-tiles.ts`

### Event capture

Five handlers append to the event log (`index.ts` routes → `bingo.ts` capture functions):

| Handler | Trigger | Appended fields |
|---------|---------|-----------------|
| `captureCommentEvent` | `onCommentCreate` | type, author, body (first 500 chars), postId |
| `capturePostEvent` | `onPostSubmit` | type, author, title (200 chars), body (500 chars), flair, postId |
| `capturePostReportEvent` | `onPostReport` | type, postId, meta (report reason) |
| `captureCommentReportEvent` | `onCommentReport` | type, postId, meta (report reason) |
| `captureModActionEvent` | `onModAction` | type, postId, meta (raw mod-log action string, e.g. `removecomment`) |

Events are stored in `bot:bingo:game:{gameId}:events` (sorted set, capped at 1000, score = timestamp, 8-day TTL).

### Batch validation

`runBatchValidation(gameId)` — fully deterministic, no external API calls:

1. Fetches all events from Redis (up to 1000)
2. Groups them into per-post "counted threads" (`buildCountedThreadsFromEvents`) — running tallies like comment count, report count, removed-comment count, em-dash count, etc.
3. Runs every `TILE_VALIDATORS[i].validate(thread)` against each thread
4. For each tile that fires: writes `1` to `bot:bingo:game:{gameId}:value:{valueKey}` (8-day TTL), records the first-trigger timestamp (`recordFirstTrigger`), and — if the tile defines an `attribute(thread)` function (e.g. `em-dash-epidemic`) — resolves who's most responsible
5. Tracks self-trigger: if the attributed author previously self-triggered and a *different* author now triggers it, the self-trigger record is cleared (the tile then counts as a community trigger for everyone)

### Self-trigger rule

A tile that was triggered by the person whose card is being checked does **not** count toward their win (`checkTiles` / `countsForWin` in `bingo.ts`). This prevents a user from winning by generating all the events themselves. The restriction is removed once someone else also triggers the tile.

---

## Win Checking

`checkWin(squares)` in `bingo.ts`:

Evaluates all 12 win lines over the user's 25-square card:
- 5 rows
- 5 columns
- 2 diagonals

A square "counts" toward a win if it's marked and not self-triggered for that user; the FREE square always counts. Returns `{ hasWin, winningIndices }`. "Full card" is a separate check: every square marked and not self-triggered.

---

## Winner Announcement

`announceWinners(gameId)` (called every scheduler cycle, after `runBatchValidation`):

1. Reads every known user ID from the `bot:bingo:game:{gameId}:users` hash
2. For each user, loads their card, runs `checkTiles` + `checkWin`
3. Tracks announced winners per goal type in `bot:bingo:game:{gameId}:announced-goals:{bingo|full_card}`
4. Posts a comment to the game post for each new winner (no duplicate announcements) — the very first bingo winner gets `bingoFirstWinnerMessage`, later bingo winners get `bingoBingoMessage`, full-card winners get `bingoFullCardMessage` (`{userId}` is replaced with the winner's username)

---

## Tile Definitions

**File:** `src/server/tiles.ts` (definitions) / `src/server/deterministic-tiles.ts` (matcher logic)

Each tile has:
- `valueKey` — Unique identifier used in all Redis keys
- `validate(thread)` — Function that returns `true` when the tile should fire, given a post's accumulated counted-thread stats
- `attribute(thread)` *(optional)* — Returns the username most responsible for the trigger, or `null` for a community trigger
- `displayName` — Human-readable name (used in the mod stats panel)
- `label` — Short label shown on the bingo card
- `gameDescription` — Flavor-text rule description shown in the game UI

### Full Tile List (33 tiles)

| valueKey | Label | Notes |
|----------|-------|-------|
| `tear-me-apart` | Tear My Theory Apart | OP invites harsh criticism |
| `coherence-drop` | "Coherence" in a Post | |
| `resonance-drop` | "Resonance" in a Post | |
| `ontology-drop` | "Ontology" in a Post | |
| `unrendered-latex` | Unrendered LaTeX in Post | |
| `consciousness-drop` | "Consciousness" in a Post | |
| `framework-drop` | "Framework" in a Post | |
| `cosmological-constant-drop` | "Cosmological Constant" in Post | |
| `hubble-tension-drop` | "Hubble Tension" in a Post | |
| `toroidal-drop` | "Toroidal" in a Post | |
| `fully-falsifiable-drop` | "Falsifiable" in a Post | |
| `emergent-drop` | "Emergent" in a Post | |
| `quarantine-discourse` | Sub Is LLM Paper Quarantine | Comment argues the sub shouldn't host these posts |
| `explain-without-llm` | "Explain Without an LLM" | |
| `thats-a-great-question` | "That's a Great Question" | LLM-style sycophantic comment opener |
| `dunning-kruger-mention` | Dunning-Kruger in Comments | |
| `not-even-wrong` | "Not Even Wrong" Comment | |
| `citation-needed` | "Citation Needed" Comment | |
| `where-math` | The "Where Math" Comment | |
| `op-cant-do-math` | OP Admits They Can't Do the Math | |
| `llms-cant-do-math` | "LLMs Can't Do Math" Comment | |
| `lean4-proof` | Lean 4 Proof as Evidence | |
| `two-person-war` | Two-Person Comment War | One post, 50+ comments, 75%+ from OP + one other user |
| `em-dash-epidemic` | 40 Em-Dashes in One Post | Has an `attribute()` — credited to the dominant em-dash contributor |
| `unfinished-work-disclaimer` | Explicitly Incomplete Work | |
| `did-you-read-your-post` | "Did You Read Your Post?" | |
| `did-you-read-my-post` | "Did You Read MY Post?" | |
| `comment-purge` | 7+ Comments Removed in Post | Mod-action tile |
| `scalar-field-drop` | "Scalar Field" in a Post | |
| `tensor-drop` | "Tensor" in a Post | |
| `comment-explosion` | 120+ Comments on a Post | |
| `xkcd-3155` | Someone Cites XKCD 3155 | |
| `is-op-qualified` | OP = Physicist? | |

`missing-the-joke` and `depth-cap-spiral` exist as shelved/unused matcher functions in `deterministic-tiles.ts` but are not currently wired into `TILE_VALIDATORS` — they're not part of the live 33-tile pool.

---

## Redis Key Reference

| Key | Type | Description |
|-----|------|-------------|
| `bot:bingo:current-game` | String (JSON) | `{ gameId, startedAt }` for the active game |
| `bot:bingo:game:{gameId}:events` | Sorted set | All captured events (JSON), score = timestamp, capped 1000 |
| `bot:bingo:card:{gameId}:{userId}` | String (JSON) | The user's 25-square card |
| `bot:bingo:game:{gameId}:users` | Hash | All known player userIds → `'1'` |
| `bot:bingo:game:{gameId}:posts` | Hash | All postIds tagged as belonging to this game |
| `bot:bingo:game:{gameId}:value:{valueKey}` | String | `"1"` if tile has been triggered |
| `bot:bingo:game:{gameId}:triggered-at:{valueKey}` | String | Unix ms timestamp of first trigger |
| `bot:bingo:game:{gameId}:triggered-by:{valueKey}` | String | Lowercased username who self-triggered (cleared once a different user also triggers it) |
| `bot:bingo:game:{gameId}:announced-goals:{bingo\|full_card}` | String (JSON array) | UserIds already announced for that goal |
| `bot:bingo:game:{gameId}:won` | String | `"1"` once any player has won a line (marks subsequent winners as non-first) |
| `bot:bingo:test:{userId}:events` | Sorted set | Per-mod sandbox test batch (see Testing below), 24h TTL |
| `bot:bingo:sim:data` | String (JSON) | Cached 7-day historical simulation dataset, 48h TTL |
| `flood:post:{postId}` | Hash | Tagged with `gameId` — shared with `moderator-toolbox`'s Flood Moderator tracking |

All game keys use `GAME_TTL_SECS = 60 * 60 * 24 * 8` (8 days) unless noted otherwise.

---

## Settings & Moderator Tools

There is no Devvit settings menu for this app — moderators configure the game and inspect its state from a panel inside the bingo post's own webview (calling the `/api/bingo/*` routes below, all mod-gated via `requesterIsMod()`).

| Key | Default | Description |
|-----|---------|-------------|
| `bingoFirstWinnerMessage` | `'🎉 **FIRST BINGO!** Congrats to u/{userId} for being the first to win!'` | Posted for the first bingo winner |
| `bingoBingoMessage` | `'✅ Bingo! u/{userId} got five in a row!'` | Posted for subsequent bingo winners |
| `bingoFullCardMessage` | `'⭐ FULL CARD! u/{userId} marked all 25 tiles! Incredible!'` | Posted for full-card winners |
| `bingoRoundDurationDays` | `0` | If > 0, the scheduler resets to a fresh game once a round has run this long (`0` = never auto-reset) |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/bingo/state` | Returns the caller's card, win status, and mod flag (auto-generates a card on first call) |
| `GET` | `/api/bingo/stats` | *(mod only)* Per-tile first-trigger time/attribution + Monte Carlo pacing analysis (`pacing.ts`) |
| `GET` | `/api/bingo/settings` | *(mod only)* Current message templates + round duration |
| `POST` | `/api/bingo/settings` | *(mod only)* Update message templates/round duration; `runBatchNow: true` forces an immediate validation pass |
| `POST` | `/api/bingo/test/resolve` | *(mod only)* Resolve a real post/comment ID from the current sub into the caller's private test batch |
| `POST` | `/api/bingo/test/run` | *(mod only)* Evaluate the caller's test batch against all tiles — no live writes |
| `POST` | `/api/bingo/test/clear` | *(mod only)* Clear the caller's test batch |
| `GET` | `/api/bingo/simulation` | *(mod only)* Cached 7-day historical tile-pacing simulation, if computed |
| `POST` | `/api/bingo/simulation/fetch-day` | *(mod only)* Fetch and evaluate one day (0–6) of real subreddit history; called 7× sequentially to build the full dataset without hitting Devvit's per-request timeout |
| `POST` | `/internal/menu/create-bingo-post` | *(mod only, subreddit menu)* Creates a new bingo custom post and starts a game |
| `POST` | `/internal/menu/dump-winners` | *(mod only, subreddit menu, temporary/debug)* Logs the active game's announced winners to `devvit logs` |

### Testing without waiting for real activity

The "Direct Inject Test" harness (`resolveTestEvent` / `runTestValidation` / `clearTestBatch`) lets a moderator pull a real post or comment from the current subreddit by ID into a private, per-mod sandbox (`bot:bingo:test:{userId}:events`) and run tile evaluation against it — without touching any live `bot:bingo:game:*` state. This is separate from the **Simulation** feature, which replays a full week of real subreddit history day-by-day to estimate how quickly tiles would fire and cards would fill under realistic conditions.

---

## Developer Guide

### Adding a tile

1. Write a `validate(thread: CountedThread): boolean` function (and, optionally, an `attribute(thread): string | null` function) in `src/server/deterministic-tiles.ts`.
2. Add a new entry to the `TILE_VALIDATORS` array in `src/server/tiles.ts`:

```typescript
{
  valueKey: 'my-new-tile',
  validate: myNewTileValidator,
  displayName: 'My New Tile',
  label: 'Short label shown on the card',
  gameDescription: 'Flavor text shown in the game UI',
},
```

3. No other changes are needed — the card generator draws from the full `TILE_VALIDATORS` pool automatically, and the batch validator runs every tile's `validate()` each cycle.

**Note:** The live pool is currently 33 tiles. Card generation needs at least 24 to fill a card without repeats; there's no hard upper limit.

### Scheduler

The scheduler endpoint `POST /internal/scheduler/bingo-batch-check` runs on a fixed hourly cron (`devvit.json` → `scheduler.tasks["bingo-batch-check"].cron`, currently `'0 * * * *'`). Each run:
1. Resets the round if `bingoRoundDurationDays` is set and exceeded
2. `runBatchValidation(gameId)`
3. `announceWinners(gameId)`

Changing the cadence requires editing `devvit.json` and redeploying — it is not a runtime setting.

### Build & Deploy Cycle

```bash
npm run build
devvit playtest r/llmphysics_dev
devvit upload
```

---

Created by u/AllHailSeizure for r/LLMPhysics.
