# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace layout

This is an npm workspaces monorepo with a shared-packages architecture:

**Shared packages (reusable logic):**
- `packages/bot-core/` — Bot module logic (helpers, trigger/action/command modules, admin UI, types). Used by all bot deployments. Deployment-agnostic via `BotConfig` injection.
- `packages/bingo-core/` — Bingo game engine (route handlers, validator, pacing, simulation, settings). Game mechanics only—not tile content. Used by all bingo deployments.

**Deployment apps (thin shells + sub-specific content):**
- `llmphysics-bot/` — llmphysics bot: imports from bot-core, configures via `initBotCore()`, registers modules in `registry.ts`
- `llmphysics-bingo/` — llmphysics bingo: imports engine from bingo-core, provides own tile definitions + evaluators
- Future `<newsub>-bot/` — new sub's bot (same as llmphysics-bot but different config + registry)
- Future `<newsub>-bingo/` — new sub's bingo (same layout but new tiles, new art, new evaluators)

**Infrastructure:**
- `supabase/` — Supabase CLI project (eimdgqymjwfljtapnuyl; bot_logs + review_jobs schema)
- `scripts/` — PowerShell/bash helpers for playtest, publish, port management
- `.claude/CLAUDE.md` — Claude Code behavior preferences for this workspace

The detailed app guides live in each deployment's `CLAUDE.md`. Read the relevant one before touching source files.

**Architecture rationale:**
- **Avoid duplication.** Bot module logic (flood mod, depth cap, length mod, etc.) is identical across subs. Bingo mechanics (card generation, validation, pacing) are identical. Moving these to shared packages means one place to fix bugs or add features.
- **Enable customization.** Each deployment injects its identity (`BotConfig`, `BingoConfig`) at startup. Modules don't hardcode "llmphysics-bot" or "LLMPhysics Bingo!"; they read from config. New subs can use the same modules with different settings.
- **Keep content separate.** Bingo tiles are sub-specific (what makes a "bingo" in r/llmphysics differs from r/newphysics). Tile definitions and evaluator functions stay in each deployment. Bingo-core provides only the game engine.
- **Single build artifact.** Vite's `resolve.alias` + tsconfig `paths` ensure shared packages are bundled inline into each app's single `dist/server/index.cjs`. Devvit gets one runnable file per app, not a dependency tree.

## Commands

From any deployment app (e.g., `llmphysics-bot/`, `llmphysics-bingo/`, or a new `<newsub>-bot/`):
```bash
npm run build                        # compile TypeScript → dist/server/index.cjs
devvit playtest r/llmphysics_dev     # upload bundle and stream logs
devvit publish                       # submit to Devvit platform
```

## Creating a new deployment app

When adding support for a new subreddit, follow this pattern. Example: setting up `newphysics-bot`.

### 1. Create deployment directory structure
```
newphysics-bot/
├── devvit.json           (copy from llmphysics-bot/devvit.json, change app name + icon)
├── package.json          (copy from llmphysics-bot/package.json, change name/version)
├── tsconfig.json         (copy from llmphysics-bot/tsconfig.json — unchanged)
├── vite.config.ts        (copy from llmphysics-bot/vite.config.ts — unchanged)
├── assets/               (new sub's art + icon)
└── src/
    ├── client/
    │   └── assets.d.ts   (copy from llmphysics-bot/src/client/assets.d.ts)
    └── server/
        ├── index.ts      (copy from llmphysics-bot/src/server/index.ts — 9-line entry point, unchanged)
        └── registry.ts   (CUSTOMIZE: change config values in initBotCore(), pick modules)
```

### 2. Update devvit.json
- Change `"name"` to `"newphysics-bot"` (must be unique on Devvit platform)
- Change dev subreddit if desired (usually stays as r/llmphysics_dev for testing)
- Update icon path to point to assets

### 3. Update package.json
- Change `"name"` to `"newphysics-bot"`
- Set `"version"` to your starting version (usually `"1.0.0"`)
- Keep all dependencies unchanged (already hoisted by npm workspaces)

### 4. Customize registry.ts
```typescript
import { initBotCore, ... } from '@llmphysics/bot-core';

initBotCore({
  botMention:   'u/NewPhysics-bot',        // adjust to your bot account
  botUsername:  'newphysics-bot',
  devSubreddit: 'llmphysics_dev',          // or your test sub
  userAgent:    'newphysics-bot/1.0 (Reddit bot; r/newphysics)',
  botAuthors:   new Set(['AutoModerator', 'YourTeamAccount', 'newphysics-bot']),
});

// Cherry-pick modules. Example: just the adversarial reviewer:
export const POST_SUBMIT    = [];
export const COMMENT_CREATE = [];
export const POST_REPORT    = [runOnPostReport];
export const MOD_ACTIONS    = [];
// ... etc, then registerAll() registers only the modules you enable
```

### For bingo deployments (e.g., `newphysics-bingo`)

Same structure, but with TWO additional files in `src/server/`:

```
newphysics-bingo/src/server/
├── index.ts                  (similar to bot, but imports from bingo-core)
├── tiles.ts                  (NEW — define your tile content + TILE_VALIDATORS)
└── deterministic-tiles.ts    (NEW — evaluator functions for your tiles)
```

See `llmphysics-bingo/src/server/` for the pattern. Tiles are bingo-specific (what events make a "bingo" in your community), so each deployment writes its own.

### 5. Add to workspace

Edit root `package.json` to include the new app in the workspaces array (if not already there):
```json
"workspaces": [
  "packages/*",
  "llmphysics-bot",
  "llmphysics-bingo",
  "newphysics-bot"
]
```

Then run `npm install` to hoist dependencies.

### 6. Create bot account and install

- Create a new Reddit account (e.g., u/NewPhysics-bot) and link it to your Devvit developer account
- Run `devvit playtest` and install the app on your test subreddit
- Once verified, run `devvit publish` and install on the target subreddit

**Key insight:** The app code is 95% shared (bot-core or bingo-core). Your deployment customizes:
- Bot: which modules to enable + your bot's identity (mention string, account name, etc.)
- Bingo: tile definitions + visual art + evaluator functions

## Devvit upload/playtest failures — READ BEFORE RETRYING

`"You must be logged in to upload a new app version"` has **two unrelated causes** that print the **same** message. Do not assume auth. **Diagnose first:**

```powershell
Set-Location D:\Libraries\Reddit\llmphysics\llmphysics-bot   # or -bingo
npx devvit whoami        # small authenticated read
npx devvit list apps     # small authenticated read
```

- **If those FAIL → it's auth.** Fix: run `scripts\nuke-devvit-auth.ps1` (add `-CopyPaste` in remote/headless sessions). `devvit logout` + re-login is NOT enough; the script deletes the whole `~/.devvit` folder. Also confirm no `DEVVIT_AUTH_TOKEN` is set in env or any `.env` — it silently overrides the token file.
- **If those WORK but the upload still dies on `Finishing upload...` / `Uploading WebView assets...` with `ECONNRESET`, `read ECONNRESET`, or `CheckIfMediaExists failed ... fetch failed` → it's the NETWORK, not auth.** Nuking auth will not help. Switch to the mobile hotspot (known-good upload path; the home network drops large uploads). `bingo` ships web-view assets (many MB) and fails on a weak connection far more than `bot`.

The one-line rule: **if the small read commands work, stop touching auth — it's the connection.**

### Do NOT pile up background node processes

- Run **one** playtest/upload attempt at a time. Never spawn a new attempt while another is still spinning.
- The CLI binds a WebSocket on port 5678 and leaves watchers alive; stacked attempts cause EADDRINUSE and make errors worse, not better.
- Before retrying, kill stragglers with `scripts\kill-devvit.ps1` (surgically kills only devvit node processes + frees port 5678 — does NOT touch VS Code/esbuild/vitest node).
- A failed upload is NOT a reason to immediately retry. Diagnose with the read commands above first. Retry spirals (this happened: 8 attempts in one session) just stack zombie processes and obscure the real error.

## Git branches

| Branch | Location | Purpose |
|---|---|---|
| `develop` | Local only | Sandbox — both apps |
| `publish-bot` | Local + remote | Verified bot modules only |
| `publish-bingo` | Local + remote | Verified bingo releases only |
| `master` | Local + remote | Integration point; both apps |
| `origin/master` | Remote | Deployed state |

Work on `develop`. Stage verified files onto `publish-bot` or `publish-bingo`. Merge to `master` → `origin/master` to deploy.

## How the shared packages work

### Bot-core architecture

All bot module logic lives in `packages/bot-core/src/`:
- `helpers/` — log, settings, redis, paper-fetch, command parsing
- `trigger-modules/` — depth-cap, flood, length, report, self-response (5 modules)
- `action-modules/` — adversarial-reviewer, mop-tool, response-tool, quota-viewer (4 modules)
- `command-modules/` — define-command (side-effect import at startup)
- `admin.ts` — settings UI for mods
- `types.ts` — shared TypeScript types
- `config.ts` — `BotConfig` interface and `initBotCore()` / `getBotConfig()` functions

**Deployment wiring** (`llmphysics-bot/src/server/registry.ts`):
1. Calls `initBotCore({ botMention, botUsername, ... })` at startup
2. Exports trigger arrays: `POST_SUBMIT = [runOnPost, runQuotaCheck, runLengthModerator]`, etc.
3. `registerAll(app)` registers action/admin modules as Hono routes
4. `index.ts` (9 lines) calls `registerAll(app)` and starts the server

Any module that needs the bot's identity (account name, mention string, etc.) calls `getBotConfig()` lazily inside its handler—never at module scope. This keeps initialization order simple.

### Bingo-core architecture

Game engine logic lives in `packages/bingo-core/src/`:
- `bingo.ts` — route handlers (state endpoint, stats, post creation, test harness)
- `validator.ts` — validator loop: reads event log, calls tile evaluators, persists triggered tiles
- `pacing.ts` — Monte Carlo: simulates random cards and computes time-to-bingo percentiles
- `simulation.ts` — Reddit API fetch + real event simulation for testing
- `settings.ts` — Redis read/write for game settings
- `types.ts` — `TileValidatorDefinition`, `BingoEvent`, etc.
- `config.ts` — `BingoConfig` with `postTitle` and `tiles` array, plus two functions the engine needs: `buildCountedThreads` and `evaluate`

**Deployment wiring** (`llmphysics-bingo/src/server/index.ts`):
1. Calls `initBingoCore({ postTitle, tiles, buildCountedThreads, evaluate })` at startup
2. Imports `routes from bingo-core and mounts them on Hono app
3. Provides `tiles.ts` (tile definitions + evaluators) and `deterministic-tiles.ts` (evaluator functions)

**Why tiles and evaluators are per-deployment:**
Validator.ts needs to call the evaluator functions to check if a tile has been triggered. But evaluators are domain-specific: "has someone posted without hosting a paper?" is a valid bingo in r/llmphysics but meaningless in a different subreddit. Each deployment defines its own tiles + evaluators and injects them via `BingoConfig` at startup.

### Vite bundling

Both deployments use Vite with the `@devvit/start/vite` plugin:
- `vite.config.ts` has a `resolve.alias` pointing `@llmphysics/bot-core` (or `bingo-core`) to `../packages/<pkg>/src`
- `tsconfig.json` has matching `paths` entries for type-checking
- When building, Vite resolves the alias, reads TypeScript source from the shared package, transpiles everything together, and outputs a single `dist/server/index.cjs`
- The Devvit platform receives one CommonJS file with zero external requires—no runtime dependencies

This is why shared packages have `"main": "./src/index.ts"` and no build step. Source linking + Vite bundling handles it all.

## Git tag convention

- `bot/v2.x.x` — llmphysics-bot releases
- `bingo/v1.x.x` — llmphysics-bingo releases
