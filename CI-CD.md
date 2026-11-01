# CI and releases

CI checks pull requests and pushes to `master`, `develop`, `publish-bot`, and
`publish-bingo`. Each current app has an independent job on Node 24. Dependencies
come from `package-lock.json` using `npm ci`; successful build artifacts are kept
for seven days. The existing GitHub Pages workflow still publishes the legal site.

Hosted jobs use Ubuntu 24.04 and install its `redis-server` package before npm.
`REDISMS_SYSTEM_BINARY=/usr/bin/redis-server` tells the Devvit test harness to use
that executable for isolated Redis instances. This avoids downloading and
compiling Redis during npm installation and keeps the actual Redis-backed tests.
For local Linux checks, install Redis and export that variable before `npm ci`
to use the same setup.

| App directory | Devvit app | Checks |
| --- | --- | --- |
| `moderator-toolbox` | `moderator-toolbox` | Nonresponder unit tests, both process-review regression suites, Vite build |
| `adversarial-review` | `adversarial-review` | Vite build; this app has no unit test suite yet |
| `sub-bingo` | `llmphysics-bingo` | Vitest suite, Vite build, source-map stripping |

Run the same checks locally:

```sh
npm ci
npm run check
# Or select one app:
npm run check --workspace ./moderator-toolbox
```

Legacy workspaces remain available, but are outside this CI matrix. Lint and
standalone TypeScript checks are not release gates; these commands need to be
made consistent across the apps before adding them to `check`.

## Publish a release

After merging the workflows to `master`, open **Actions → Release Devvit app →
Run workflow** and select the `master` branch. Choose one app directory, enter an
explicit stable version such as `2.16.0`, and choose whether to request public
review. The default submits an unlisted release. The directory `sub-bingo` still
publishes the Devvit app named `llmphysics-bingo`, as configured in `devvit.json`.

The workflow rejects other branches and invalid versions, runs the selected
app's exact CI checks, verifies authentication, and then publishes. All releases
share one concurrency group so uploads do not overlap. It uses the installed,
locked CLI rather than updating Devvit during a release, and sets
`DEVVIT_ALLOW_SOURCE_UPLOAD=1` to allow the source archive required by publishing.
The root CLI is pinned to `devvit@0.13.6`: `devvit@1.0.0` is a deprecated
placeholder without an executable, so it cannot provide a release command.
Version changes made by the CLI stay on the runner; the workflow does not commit
them or create Git tags.

Publishing submits a version to Devvit. Reddit's review and each community's
installed version remain platform concerns: this workflow does not run
`devvit install` or deploy Supabase functions/migrations. See the official
[launch guide](https://developers.reddit.com/docs/guides/launch/launch-guide).

## Release credential

The repository needs one Actions secret named `DEVVIT_AUTH_TOKEN`, using the
complete contents of the logged-in developer's `~/.devvit/token` file. To set or
rotate it without printing the credential, log in to Devvit and run this from
PowerShell in the repository:

```powershell
devvit whoami
Get-Content -LiteralPath (Join-Path $env:USERPROFILE '.devvit/token') -Raw |
  gh secret set DEVVIT_AUTH_TOKEN
```

The workflows expose the secret only to the authenticated CLI steps in the
master-only release job. Pull request checks do not receive it. If the two small
authentication reads succeed but uploading fails, investigate connectivity
before changing the token. There are no automatic publish retries.

## Required checks

The check names are `Check moderator-toolbox`, `Check adversarial-review`, and
`Check sub-bingo`. They can be selected in a branch ruleset for `master` after the
first CI run. Adding the workflows does not change existing merge permissions.
