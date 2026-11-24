# Reddit-Devvit

Reddit apps for [r/LLMPhysics](https://reddit.com/r/LLMPhysics), built on
Reddit's [Devvit](https://developers.reddit.com/docs) platform. This is an npm
workspaces monorepo: each top-level app folder is a separate Devvit app with
its own `devvit.json`.

## Apps

| Folder | Devvit app | What it does | In CI |
| --- | --- | --- | --- |
| [`moderator-toolbox`](moderator-toolbox/README.md) | `moderator-toolbox` | Moderation assistant: posting-rule enforcement, comment-chain handling, `!define` term lookup, and mod menu tools. Includes Supabase functions in `supabase/`. | yes |
| `adversarial-review` | `adversarial-review` | Post menu item "Request Adversarial LLM Review", which sends a post and its linked content for an LLM review via Supabase. | yes |
| [`sub-bingo`](sub-bingo/README.md) | `llmphysics-bingo` | Community bingo game: each player gets a 5×5 card of subreddit events. | yes |
| `tap-the-sign` | `tap-the-sign` | Post menu item "Tap the Sign": comments the sign image once per post and can add a readable rendering of the post's math. | yes |
| [`llmphysics-bot`](llmphysics-bot/README.md) | `llmphysics-bot` | Older all-in-one moderation bot, including AI paper review (now in `adversarial-review`). | no (legacy) |
| `review-bot` | `review-bot` | Older adversarial-reviewer-only bot. | no (legacy) |

Other folders:

- `packages/bot-core/`: shared bot module logic (`@llmphysics/bot-core`).
- `docs/`: Jekyll site with each app's terms of service and privacy policy, published to GitHub Pages.
- `scripts/`: local PowerShell/bash helpers for playtesting and publishing, plus `verify-*.mjs` checks.
- `CI-CD.md`: how CI and releases work in detail.

Each app folder has its own `CLAUDE.md` or `README.md` with app-specific detail.
The root `CLAUDE.md` describes an older layout and doesn't match every folder.

## Setup

Requirements:

- Node 24 (see `.node-version`).
- A Devvit account, for playtesting and publishing.
- On Linux, `redis-server`. The Devvit test harness needs Redis. Install it and
  set `REDISMS_SYSTEM_BINARY` before `npm ci`, the same way CI does:

```sh
sudo apt-get install redis-server
export REDISMS_SYSTEM_BINARY=/usr/bin/redis-server
npm ci
```

The Devvit CLI is pinned at the root (`devvit@0.13.6`) and runs through npm, for example `npx devvit login`.

## Develop and test

From the repository root:

```sh
npm run check                                   # tests + build for all CI apps
npm run check --workspace ./moderator-toolbox   # one app
```

Inside an app folder:

```sh
npm test         # Vitest (moderator-toolbox, sub-bingo, tap-the-sign)
npm run build    # Vite build to dist/
npm run lint     # ESLint
npm run dev      # devvit playtest r/llmphysics_dev
```

Lint is not part of `check` or CI yet (see `CI-CD.md`).

## CI and deploy

- **CI** (`.github/workflows/ci.yml`) runs `npm run check` for
  `moderator-toolbox`, `adversarial-review`, `sub-bingo`, and `tap-the-sign`
  on pull requests and on pushes to `master`, `develop`, `publish-bot`, and
  `publish-bingo`.
- **Release** (`.github/workflows/release.yml`) is a manual workflow: in
  **Actions → Release Devvit app → Run workflow**, pick the `master` branch, an
  app, and an exact version. It reruns that app's checks and publishes with the
  `DEVVIT_AUTH_TOKEN` secret. It does not run `devvit install` or deploy
  Supabase functions.
- **Pages** (`.github/workflows/pages.yml`) publishes `docs/` when it changes on
  `master`.

See [`CI-CD.md`](CI-CD.md) for the release credential setup and details.
