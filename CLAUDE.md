# CLAUDE.md — llmphysics-bot Devvit App

This file contains reference documentation for the Devvit platform (Reddit's app framework)
extracted from official documentation, plus the planned architecture for the llmphysics-bot app.

---

# Bot Architecture (llmphysics-bot)

## Design Goals

`llmphysics-bot` is a modular, incrementally expandable moderation-assistance bot for r/llmphysics.
It starts bare-bones and gains capabilities as new modules are added — without ever touching the
core dispatch or entry-point files.

---

## File Structure

```
llmphysics-bot/
├── devvit.json                    # App config: triggers, permissions, build script
├── package.json
├── tsconfig.json
├── .gitignore
├── CLAUDE.md                      # This file
└── src/
    └── server/
        ├── index.ts               # Hono app — mounts all routes, never changes
        ├── logger.ts              # Structured logger (level + module + timestamp)
        ├── types.ts               # Shared TypeScript types
        ├── registry.ts            # Module registry — THE file you edit to add a module
        └── modules/
            ├── app-install.ts     # Starter: runs on bot install/upgrade
            ├── post-monitor.ts    # Starter: logs every new post submission
            └── <future-module>.ts # Each new capability lives here
```

---

## Module Pattern

Every module is a **self-contained `.ts` file** that:
- Imports only what it needs (`reddit`, `redis`, `logger`, shared types)
- Exports a single `run(event)` function typed to its trigger
- Has zero knowledge of other modules

```typescript
// src/server/modules/example-module.ts
import { reddit } from '@devvit/web/server';
import type { OnPostSubmitRequest } from '@devvit/web/shared';
import { logger } from '../logger';

const log = logger('example-module');

export async function run(event: OnPostSubmitRequest): Promise<void> {
  log.info('New post', { postId: event.post.id });
  // ... module logic using reddit, redis, etc.
}
```

---

## Adding a New Module (2 lines of code)

Open `src/server/registry.ts` and add:

```typescript
// Line 1 — import at the top
import { run as myNewModule } from './modules/my-new-module';

// Line 2 — register under the right trigger array
export const POST_SUBMIT = [postMonitor, myNewModule];
//                                        ^^^^^^^^^^^^ added
```

That's it. `index.ts` and `devvit.json` do **not** need to change when adding a module to an
existing trigger type. (Adding a brand-new trigger type requires one new route in `index.ts` and
one new entry in `devvit.json`, but that's a rare, one-time change per trigger.)

---

## Registry Structure

`registry.ts` exports one typed array per trigger:

| Export             | Trigger            | Description                          |
|--------------------|--------------------|--------------------------------------|
| `APP_INSTALL`      | `onAppInstall`     | Bot installed on a subreddit         |
| `APP_UPGRADE`      | `onAppUpgrade`     | Bot version updated                  |
| `POST_SUBMIT`      | `onPostSubmit`     | New post submitted                   |
| `COMMENT_CREATE`   | `onCommentCreate`  | New comment created                  |
| `POST_REPORT`      | `onPostReport`     | Post reported by a user              |
| `COMMENT_REPORT`   | `onCommentReport`  | Comment reported by a user           |
| `MOD_ACTIONS`      | `onModActions`     | A moderator took an action           |

---

## Dispatch Flow

```
Reddit event
    │
    ▼
devvit.json  →  /internal/triggers/<event>
    │
    ▼
src/server/index.ts  (Hono route)
    │
    ▼  dispatch(registry.POST_SUBMIT, event)
    │
    ├──▶ module A run(event)   ← try/catch, errors logged, continues
    ├──▶ module B run(event)
    └──▶ module C run(event)
```

Errors in one module never stop the others from running.

---

## Logger

`logger(moduleName)` returns a structured logger scoped to a module:

```typescript
const log = logger('spam-filter');
log.debug('checking post', { postId });
log.info('removed post', { postId, reason: 'spam' });
log.warn('rate limit approaching');
log.error('reddit API call failed', err, { postId });
```

Format: `[ISO timestamp][LEVEL][module-name] message {data}`

All levels write to console (visible in Devvit logs). `info`/`warn`/`error` are also
persisted to Redis under `bot:log:<level>` (capped at 500 entries) for future mod dashboard use.

---

## Planned Modules (Future)

| Module                  | Trigger              | Purpose                                      |
|-------------------------|----------------------|----------------------------------------------|
| `rule-enforcer.ts`      | `onPostSubmit`       | Auto-remove posts violating subreddit rules  |
| `flair-required.ts`     | `onPostSubmit`       | Remove unflaired posts after grace period    |
| `spam-filter.ts`        | `onPostSubmit`       | Heuristic / LLM-assisted spam detection      |
| `comment-filter.ts`     | `onCommentCreate`    | Filter low-effort or rule-breaking comments  |
| `report-handler.ts`     | `onPostReport`       | Triage reported posts, notify mods           |
| `mod-log.ts`            | `onModActions`       | Mirror mod actions to a structured log       |
| `scheduled-cleanup.ts`  | scheduler (cron)     | Periodic housekeeping tasks                  |

---

## Key Devvit APIs Used

- `reddit` from `@devvit/web/server` — post/comment/user/subreddit actions
- `redis` from `@devvit/web/server` — persistent key-value storage
- `scheduler` from `@devvit/web/server` — one-off and recurring jobs
- `@devvit/web/shared` — TypeScript types for all trigger event payloads

---

# Devvit Documentation Reference

See DEVVIT_REFERENCE.md` for devvit.json schema, Hono routing, triggers, Redis patterns, and API client usage.

