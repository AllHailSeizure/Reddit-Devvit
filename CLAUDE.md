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

## 1.1 Devit Config

Configure your app | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Devvit Setup Overview
Devvit Configuration
On this page
# Configure your app
The devvit.json file serves as your app's configuration file. Use it to specify entry points, configure features like event triggers and scheduled actions, and enable app functionality such as image uploads. This page covers all available devvit.json configuration options. A complete devvit.json example file is provided here.
## devvit.json​
The
```
devvit.json
```
schema is available and is self-documented.
All configuration files should include a
```
$schema
```
property which many IDEs will use to make suggestions and present documentation:
```
{ "$schema": "https://developers.reddit.com/schema/config-file.v1.json"}
```
## Required properties​
Your
```
devvit.json
```
must include:
```
name
```
(required): App account name and Community URL slug. Must be 3-16 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens.
Additionally, you must include at least one of:
```
post
```
: For web view apps
```
server
```
: For Node.js server apps
## Configuration sections​
### Core properties​
Property
Type
Description
Required
```
name
```
string
App account name and Community URL slug (3-16 chars,
```
^[a-z][a-z0-9-]*$
```
)
Yes
```
$schema
```
string
Schema version for IDE support
No (recommended)
### App components​
Property
Type
Description
Required
```
post
```
object
Custom post/web view configuration
One of post/server
```
server
```
object
Node.js server configuration
One of post/server
### Permissions & capabilities​
Property
Type
Description
Required
```
permissions
```
object
What your app is allowed to do
No
```
media
```
object
Static asset configuration
No
```
marketingAssets
```
object
Assets for featuring your app
No
### Event handling​
Property
Type
Description
Required
```
triggers
```
object
Event trigger endpoints
No (requires server)
```
scheduler
```
object
Scheduled task configuration
No
### UI & interaction​
Property
Type
Description
Required
```
menu
```
object
Menu items in posts, comments, subreddits
No
```
forms
```
object
Form submission endpoints
No
### Development​
Property
Type
Description
Required
```
dev
```
object
Development configuration
No
```
scripts
```
object
Build commands run by the Devvit CLI (optional)
No
## Detailed configuration​
### Post configuration​
Configure web views for custom post types:
```
{ "post": { "dir": "public", "entrypoints": { "default": { "entry": "index.html", "height": "tall" } } }}
```
Properties:
```
dir
```
(string): Client directory for web view assets (default:
```
"public"
```
)
```
entrypoints
```
(object): Map of named entrypoints for post rendering
Must include a
```
"default"
```
entrypoint
```
entry
```
(string): HTML file path or
```
/api/
```
endpoint
```
height
```
(enum):
```
"regular"
```
or
```
"tall"
```
(default:
```
"regular"
```
)
### Server configuration​
Configure Node.js server functionality:
```
{ "server": { "entry": "src/server/index.js" }}
```
Properties:
```
entry
```
(string): Server bundle filename (default:
```
"src/server/index.js"
```
)
Server bundles must be compiled to CommonJS (
```
cjs
```
). ES module output is not supported by the Devvit Web runtime.
### Permissions configuration​
Control what your app can access:
```
{ "permissions": { "http": { "enable": true, "domains": ["example.com", "api.github.com"] }, "media": true, "payments": false, "realtime": false, "redis": true, "reddit": { "enable": true, "asUser": ["SUBMIT_POST", "SUBMIT_COMMENT"] } }}
```
HTTP plugin:
```
enable
```
(boolean): Enable HTTP plugin (default:
```
true
```
)
```
domains
```
(array): Allowed domains for
```
fetch()
```
calls
Reddit API plugin:
```
enable
```
(boolean): Enable Reddit API (default:
```
true
```
)
```
scope
```
(enum):
```
"user"
```
or
```
"moderator"
```
(default:
```
"user"
```
)
```
asUser
```
(array): APIs to execute as user account
Other permissions:
```
media
```
(boolean): Enable media uploads (default:
```
false
```
)
```
payments
```
(boolean): Enable payments plugin (default:
```
false
```
)
```
realtime
```
(boolean): Enable realtime messaging (default:
```
false
```
)
```
redis
```
(boolean): Enable Redis storage (default:
```
false
```
)
### Triggers configuration​
Handle Reddit events:
```
{ "triggers": { "onPostCreate": "/internal/triggers/post-create", "onCommentSubmit": "/internal/triggers/comment-submit", "onModAction": "/internal/triggers/mod-action" }}
```
Available triggers:
```
onAppInstall
```
,
```
onAppUpgrade
```
```
onPostCreate
```
,
```
onPostDelete
```
,
```
onPostSubmit
```
,
```
onPostUpdate
```
,
```
onPostReport
```
,
```
onPostFlairUpdate
```
,
```
onPostNsfwUpdate
```
,
```
onPostSpoilerUpdate
```
```
onCommentCreate
```
,
```
onCommentDelete
```
,
```
onCommentSubmit
```
,
```
onCommentUpdate
```
,
```
onCommentReport
```
```
onModAction
```
,
```
onModMail
```
```
onAutomoderatorFilterPost
```
,
```
onAutomoderatorFilterComment
```
Note: All trigger endpoints must start with
```
/internal/
```
and will receive POST requests with JSON data.
### Menu configuration​
Add menu items to subreddit interfaces:
```
{ "menu": { "items": [ { "label": "Approve Post", "description": "Quickly approve this post", "forUserType": "moderator", "location": ["post"], "endpoint": "/internal/menu/approve-post", "postFilter": "none" }, { "label": "Report Issue", "description": "Report a problem with this post", "forUserType": "user", "location": ["post", "comment"], "endpoint": "/internal/menu/report-issue" } ] }}
```
Menu item properties:
```
label
```
(string): Display text (required)
```
description
```
(string): Short description
```
forUserType
```
(enum):
```
"moderator"
```
or
```
"user"
```
(default:
```
"moderator"
```
)
```
location
```
(string|array): Where menu appears (
```
"post"
```
,
```
"comment"
```
,
```
"subreddit"
```
)
```
endpoint
```
(string): Internal endpoint to call (required)
```
postFilter
```
(enum):
```
"none"
```
or
```
"currentApp"
```
(default:
```
"none"
```
)
### Scheduler configuration​
Configure scheduled tasks:
```
{ "scheduler": { "tasks": { "daily-cleanup": { "endpoint": "/internal/cron/daily-cleanup", "cron": "0 2 * * *" }, "hourly-check": { "endpoint": "/internal/cron/hourly-check", "cron": "0 * * * *", "data": { "checkType": "health" } }, "manual-task": "/internal/cron/manual-task" } }}
```
Task configuration:
```
endpoint
```
(string): Internal endpoint to call (required)
```
cron
```
(string): Cron schedule (optional, for automatic scheduling)
```
data
```
(object): Additional data passed to cron tasks (optional)
Cron format: Standard five-part (
```
0 2 * * *
```
) or six-part (
```
*/30 * * * * *
```
) format.
### Forms configuration​
Map form identifiers to submission endpoints:
```
{ "forms": { "contact_form": "/internal/forms/contact", "feedback_form": "/internal/forms/feedback" }}
```
### Marketing assets​
Configure app presentation:
```
{ "marketingAssets": { "icon": "assets/icon.png" }}
```
Properties:
```
icon
```
(string): Path to 1024x1024 PNG icon (required)
### Scripts configuration​
Configure build commands run by the Devvit CLI. These commands run relative to the
```
devvit.json
```
directory.
```
{ "scripts": { "dev": "vite build --watch", "build": "vite build" }}
```
Properties:
```
dev
```
(string): Command run by
```
devvit playtest
```
to build or watch your client/server artifacts
```
build
```
(string): Command run by
```
devvit upload
```
to build your client/server artifacts
### Development configuration​
Configure development settings:
```
{ "dev": { "subreddit": "my-test-subreddit" }}
```
Properties:
```
subreddit
```
(string): Default development subreddit (can be overridden by
```
DEVVIT_SUBREDDIT
```
env var)
## Validation rules​
The
```
devvit.json
```
configuration is validated against the JSON Schema at build time. Many IDEs will also underline errors as you write. Common validation errors include:
JSON Syntax: Adding comments or trailing commas (unsupported by JSON)
Required Properties: Missing the required
```
name
```
property
App Components: Missing at least one of
```
post
```
or
```
server
```
Dependencies: Missing
```
server
```
when
```
triggers
```
is specified
File References: Missing files referenced in
```
devvit.json
```
Permissions: Missing required permissions for used features
Pattern Validation: Invalid patterns for names, paths, or endpoints
## Best practices​
Always include the
```
$schema
```
property for IDE autocompletion and validation.
Use specific permission scopes. Only request permissions your app actually uses.
Set appropriate menu scopes. Consider whether features should be available to all users or just moderators.
Validate endpoints. Ensure all internal endpoints start with
```
/internal/
```
.
Use meaningful names. Choose descriptive names for entrypoints, tasks, and forms.
Test configurations. Validate your config with
```
devvit build
```
before deployment.
## Environment variables​
```
DEVVIT_SUBREDDIT
```
: Override the
```
dev.subreddit
```
value used during
```
devvit playtest
```
.
```
DEVVIT_APP_NAME
```
: Override the
```
name
```
value used during
```
devvit playtest
```
(and other similar commands).
## Complete example​
devvit.json
```
{ "$schema": "https://developers.reddit.com/schema/config-file.v1.json", "name": "my-awesome-app", "post": { "dir": "public", "entrypoints": { "default": { "entry": "index.html", "height": "tall" } } }, "server": { "entry": "src/server/index.js" }, "permissions": { "http": { "enable": true, "domains": ["api.example.com"] }, "redis": true }, "triggers": { "onPostCreate": "/internal/triggers/post-create" }, "menu": { "items": [ { "label": "Approve", "forUserType": "moderator", "location": "post", "endpoint": "/internal/menu/approve" } ] }, "scheduler": { "tasks": { "daily-cleanup": { "endpoint": "/internal/cron/cleanup", "cron": "0 2 * * *" } } }, "marketingAssets": { "icon": "assets/icon.png" }, "dev": { "subreddit": "my-test-sub" }, "scripts": { "dev": "vite build --watch", "build": "vite build" }}
```
Previous
Feature Guide
Next
Client Overview
devvit.json
Required properties
Configuration sections
Core properties
App components
Permissions & capabilities
Event handling
UI & interaction
Development
Detailed configuration
Post configuration
Server configuration
Permissions configuration
Triggers configuration
Menu configuration
Scheduler configuration
Forms configuration
Marketing assets
Scripts configuration
Development configuration
Validation rules
Best practices
Environment variables
Complete example
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 1.2 Client Overview

Client Overview | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Devvit Setup Overview
Client Overview
On this page
# Client Overview
Client-side effects enable your Devvit app to provide interactive feedback and navigation to users. These effects include showing toasts, displaying forms, navigating to different pages, and more.
Import client functions from
```
@devvit/web/client
```
:
client/index.ts
```
import { showToast, showForm, navigateTo } from '@devvit/web/client';// Show a toast notificationshowToast('Hello from Devvit Web!');// Navigate to a URLnavigateTo('https://www.reddit.com/r/webdev');// Show a form and handle responseconst result = await showForm({ form: { fields: [ { type: 'string', name: 'username', label: 'Username' } ] }});if (result) { console.log('Form submitted:', result.username);}
```
## Available client effects​
Effect
Description
API
Toast
Show temporary notification messages
```
showToast()
```
Form
Display interactive forms with promise-based responses
```
showForm()
```
Navigation
Redirect to Reddit content or external URLs
```
navigateTo()
```
:::note When to use client library functions
You should only use client library functions in response to a user-initiated action.
:::
## Menu responses​
Menu items can respond with client effects after server processing.
Menu responses allow you to:
Process data on the server before showing client effects
Chain multiple forms together in complex workflows
Validate user permissions before allowing actions
Fetch external data to populate forms or display results
For complete details and examples, see the Menu Actions documentation.
## Next steps​
Explore the specific documentation for each client effect:
Toasts - Temporary notification messages
Forms - Interactive user input
Navigation - Redirecting users
Realtime - Live updates and communication
Previous
Devvit Configuration
Next
Server Overview
Available client effects
Menu responses
Next steps
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 1.3 Server Overview

Server Overview | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Devvit Setup Overview
Server Overview
On this page
# Server Overview
Devvit offers a wide variety of features that help you integrate your app with Reddit's APIs, scale your app free of charge using Reddit's backend, and more. The features in this section are executed on the server side. They can be imported in Devvit Web applications, as well as Mod Tools.
Below is a brief explanation of all features in this section:
## HTTP fetch​
Allows you to make HTTP requests to external servers, subject to a review of the specific domains you are requesting from.
## Media uploads​
Allows you to build apps where the end user can upload custom images to Reddit's CDN. Uploaded media is subject to the same safety checks as every other media content uploaded to Reddit, ensuring community safety.
## Reddit API​
Allows you to query information from Reddit such as comments, posts and upvotes. Limited to installation scope of the application.
## Data storage (Redis)​
Allows you to store app data in a key-value database, free of charge. Limited to the installation scope of the application.
## Scheduler​
Allows you to run automated server-side tasks on a schedule, for example, checking for updates every hour.
## Secrets storage​
Allows you to build an app where the moderator can store secret keys in a safe and scalable way. For example, if your app needs the installing moderator to provide their own keys to an external API.
## Triggers​
Allows you to run automated server-side tasks when certain events happen on Reddit, for example: when a new post is created, or when a new comment is created.
## User actions​
Allows you to execute some actions, like posting or commenting, on behalf of the user. This means that these new posts or comments will not show up as created by the app, but by the user that is currently using the app. Access to this feature is subject to review by Admins.
## Text fallback​
Allows you to specify how your interactive post is displayed on platforms that don't support Devvit, for example old.reddit.com
## Cache helper​
Allows you to cache fetch requests on the server side, reducing the number of requests made to external APIs and improving performance.
Previous
Client Overview
Next
HTTP Fetch
HTTP fetch
Media uploads
Reddit API
Data storage (Redis)
Scheduler
Secrets storage
Triggers
User actions
Text fallback
Cache helper
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 2.1 HTTP Fetch

HTTP Fetch | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Access External Endpoints
HTTP Fetch
On this page
# HTTP Fetch
Make requests to allow-listed external domains.
Your Devvit app can make network requests to access allow-listed external domains using HTTP Fetch. This enables your app to leverage webhooks, personal servers, and other third-party integrations asynchronously across the network.
## Enabling HTTP fetch calls​
devvit.json
```
{ ... "permissions": { "http": { "enable": true, "domains": ["my-site.com", "another-domain.net"] } }}
```
### Requesting a domain to be allow-listed​
Apps may request a domain to be added to the allow-list by specifying
```
domains
```
in the
```
http
```
configuration.
This configuration is optional, and apps can still configure
```
http: true
```
as before.
Requested domains will be submitted for review when you playtest or upload your app. Admins may approve or deny domain requests.
Domain entries must be exact hostnames only, such as nytimes.com or wikipedia.org. These fetch requests are not allowed:
Be specific. No using
```
*.example.com
```
when you need
```
api.example.com
```
No wildcards:
```
*.example.com
```
No protocols:
```
https://api.example.com
```
No paths:
```
api.example.com/webhooks
```
Domains that are approved for your app will be displayed in the Developer Settings section for your app at
```
https://developers.reddit.com/apps/{your-app-slug}/developer-settings
```
.
These domains are allow-listed for your app only and not globally.
Apps must request each individual domain that it intends to fetch, even if the domain is already globally allowed. See the global fetch allowlist to view the list of globally allowed domains.
## Limitations​
Access is only allowed to https URIs.
Supported HTTP methods:
```
GET
```
,
```
POST
```
,
```
PUT
```
,
```
DELETE
```
,
```
OPTIONS
```
and
```
PATCH
```
.
HTTP timeout limit is 30 seconds.
## Example usage​
Devvit Web applications have two different contexts for using fetch:
### Server-side fetch​
Server-side fetch allows your app to make HTTP requests to allowlisted external domains from your server-side code (e.g., API routes, server actions):
server/index.ts
```
const response = await fetch('https://example.com/api/data', { method: 'GET', headers: { 'Content-Type': 'application/json', },});const data = await response.json();console.log('External API response:', data);
```
### Client-side fetch​
Client-side fetch has different restrictions and can only make requests to your own webview domain:
Client-side restrictions:
Domain limitation: Can only make requests to your own webview domain
Endpoint requirement: All requests must target endpoints that end with
```
/api
```
Authentication: Handled automatically - no need to manage auth tokens
No external domains: Cannot make requests to external domains from client-side code
client/index.ts
```
const handleFetchData = async () => { // Correct: fetching your own webview's API endpoint const response = await fetch("/api/user-data", { method: "GET", headers: { "Content-Type": "application/json", }, }); const data = await response.json(); console.log("API response:", data);};// Incorrect: cannot fetch external domains from client-side// const response = await fetch('https://external-api.com/data');// Incorrect: endpoint must end with /api// const response = await fetch('/user-data');
```
## Troubleshooting​
If you see the following error, it means HTTP Fetch requests are hitting the internal timeout limits. To resolve this:
Use a queue or kick off an async request in your back end. You can use Scheduler to monitor the result.
Optimize the overall HTTP request latency if you have a self-hosted server.
```
HTTP request to domain: <domain> timed out with error: context deadline exceeded.
```
### Terms and conditions​
Any app that uses
```
fetch
```
must upload Terms and Conditions and a Privacy Policy. Links to each of these documents must be saved in the app details form.
## Global fetch allowlist​
The following domains are globally allowed and can be fetched by any app:
example.com
site.api.espn.com
cdn.espn.com
discord.com
api.polygon.io
api.massive.com
polygon.io
slack.com
lichess.org
api.telegram.org
commentanalyzer.googleapis.com
language.googleapis.com
statsapi.mlb.com
api.openai.com
api.scryfall.com
api.nasa.gov
api.sportradar.us
api.sportradar.com
random.org
generativelanguage.googleapis.com
youtube.googleapis.com
api.weather.gov
wikipedia.org
finance.yahoo.com
api.twitter.com
api.petfinder.com
fonts.googleapis.com
nytimes.com
npr.org
propublica.org
pbs.org
i.giphy.com
chessboardjs.com
Previous
Server Overview
Next
HTTP Fetch Policy
Enabling HTTP fetch calls
Requesting a domain to be allow-listed
Limitations
Example usage
Server-side fetch
Client-side fetch
Troubleshooting
Terms and conditions
Global fetch allowlist
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 2.2 HTTP Fetch Policy

HTTP Fetch Policy | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Access External Endpoints
HTTP Fetch Policy
On this page
# HTTP Fetch Policy
When requesting domains to be allow-listed, they fall into three categories:
APIs that provide data or specific services (e.g.,
```
api.openai.com
```
,
```
api.wikipedia.org
```
) - These will be approved if they have a publicly documented and publicly accessible API for valid use cases, and if they adhere to the Devvit rules. Please reference our AI providers and account linking policies for common invalid use cases.
Limited scope cloud providers (e.g.,
```
username.supabase.com
```
,
```
my-app.firebase.com
```
) - May be granted with exceptions. You must:
Follow user privacy guidelines and data governance requirements
Use an approved provider from the list below (please include your subdomain, and request for the most granular domain possible, e.g.
```
my-app.s3.amazonaws.com
```
)
```
supabase.com
```
```
firebase.com
```
```
spacetimedb.com
```
```
s3.amazonaws.com
```
```
storage.googleapis.com
```
Demonstrate a capability that
```
@devvit/server
```
doesn't support
Valid use cases include:
Asset hosting (videos, images, music)
Relational databases
Note: Approval can be revoked at any time
Personal domains (e.g.,
```
personaldomain.com
```
) - Will not be approved. If you have a use case that our Devvit server does not support, please submit your request with detailed justification.
### Documentation requirements​
If your app uses fetch domains, you must add context to your app's README for the approval process:
Create a "Fetch Domains" section in your README
List each domain you're requesting and explain why you need it
Ensure your usage complies with our fetch guidelines
Example README section:
```
## Fetch DomainsThe following domains are requested for this app:- `api.wikipedia.org` - Used to fetch article summaries for the knowledge base feature- `username.supabase.com` - Required for relational database storage of user preferences (Devvit KV store doesn't support complex queries needed for this feature)
```
….
### Domain Requirements​
Domain entries must be exact hostnames only, such as nytimes.com or wikipedia.org. These fetch requests are not allowed:
Be specific. No using
```
*.example.com
```
when you need
```
api.example.com
```
No wildcards:
```
*.example.com
```
No protocols:
```
https://api.example.com
```
No paths:
```
api.example.com/webhooks
```
Domains that are approved for your app will be displayed in the Developer Settings section for your app at
```
https://developers.reddit.com/apps/{your-app-slug}/developer-settings
```
.
These domains are allow-listed for your app only and not globally.
Apps must request each individual domain that it intends to fetch, even if the domain is already globally allowed. See the global fetch allowlist to view the list of globally allowed domains.
### Terms and conditions​
Any app that uses
```
fetch
```
must upload Terms and Conditions and a Privacy Policy. Links to each of these documents must be saved in the app details form.
## Global fetch allowlist​
The following domains are globally allowed and can be fetched by any app:
example.com
site.api.espn.com
cdn.espn.com
discord.com
api.polygon.io
api.massive.com
polygon.io
slack.com
lichess.org
api.telegram.org
commentanalyzer.googleapis.com
language.googleapis.com
statsapi.mlb.com
api.openai.com
api.scryfall.com
api.nasa.gov
api.sportradar.us
api.sportradar.com
random.org
generativelanguage.googleapis.com
youtube.googleapis.com
api.weather.gov
wikipedia.org
finance.yahoo.com
api.twitter.com
api.petfinder.com
fonts.googleapis.com
nytimes.com
npr.org
propublica.org
pbs.org
i.giphy.com
chessboardjs.com
Previous
HTTP Fetch
Next
Scheduler
Documentation requirements
Domain Requirements
Terms and conditions
Global fetch allowlist
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 3.1 Schedules

Scheduler | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Automation & Triggers
Scheduler
On this page
# Scheduler
The scheduler allows your app to perform actions at specific times, such as sending private messages, tracking upvotes, or scheduling timeouts for user actions. You can schedule both recurring and one-off jobs using the scheduler.
## Scheduling recurring jobs​
To create a regularly occurring event in your app, declare a task in your
```
devvit.json
```
and handle the event in your server logic.
### 1. Add a recurring task to devvit.json​
Ensure the endpoint follows the format
```
/internal/.+
```
and specify a
```
cron
```
schedule:
devvit.json
```
"scheduler": { "tasks": { "regular-interval-example-task": { "endpoint": "/internal/scheduler/regular-interval-task-example", "cron": "*/1 * * * *" } }},
```
The
```
cron
```
parameter uses the standard UNIX cron format:
```
# * * * * *# | | | | |# | | | | day of the week (0–6, Sunday to Saturday; 7 is also Sunday on some systems)# | | | month (1–12)# | | day of the month (1–31)# | hour (0–23)# minute (0–59)
```
We recommend using Cronitor to build cron strings.
### 2. Handle the event in your server​
Hono
Express
/server/index.ts
```
import type { TaskRequest, TaskResponse } from "@devvit/web/server";app.post("/internal/scheduler/regular-interval-task-example", async (c) => { const _input = await c.req.json<TaskRequest>(); console.log(`Handle event for cron example at ${new Date().toISOString()}!`); // Handle the event here return c.json<TaskResponse>({ status: "ok" }, 200);});
```
## Scheduling one-off jobs at runtime​
One-off tasks must also be declared in
```
devvit.json
```
.
### 1. Add the tasks to devvit.json​
devvit.json
```
"scheduler": { "tasks": { "regular-interval-task-example": { "endpoint": "/internal/scheduler/regular-interval-task-example", "cron": "*/1 * * * *" }, "one-off-task-example": { "endpoint": "/internal/scheduler/one-off-task-example" } }}
```
### 2. Schedule a job at runtime​
Example usage:
Hono
Express
/server/index.ts
```
import type { TaskRequest, TaskResponse } from "@devvit/web/server";app.post("/internal/scheduler/one-off-task-example", async (c) => { const { data } = await c.req.json<TaskRequest<{ postId: string }>>(); const { postId } = data!; const oneMinuteFromNow = new Date(Date.now() + 1000 * 60); const scheduledJob: ScheduledJob = { id: `job-one-off-for-post${postId}`, name: "one-off-task-example", data: { postId }, runAt: oneMinuteFromNow, }; const jobId = await scheduler.runJob(scheduledJob); console.log(`Scheduled job ${jobId} for post ${postId}`); console.log(`Handle event for one-off event at ${new Date().toISOString()}!`); // Handle the event here return c.json<TaskResponse>({ status: "ok" }, 200);});
```
## Cancel a scheduled job​
Use the job ID to cancel a scheduled action and remove it from your app. This example shows how to set up a moderator menu action to cancel a job.
### 1. Add menu item to devvit.json​
devvit.json
```
{ "menu": { "items": [ { "label": "Cancel Job", "description": "Cancel a scheduled job", "forUserType": "moderator", "location": "post", "endpoint": "/internal/menu/cancel-job" } ] }, "permissions": { "redis": true }}
```
### 2. Handle the menu action in your server​
Hono
Express
/server/index.ts
```
import type { MenuItemRequest, UiResponse } from "@devvit/web/shared";app.post("/internal/menu/cancel-job", async (c) => { try { // Get the post ID from the menu action request const { targetId: postId } = await c.req.json<MenuItemRequest>(); // Retrieve the job ID from Redis (stored when the job was created) const jobId = await redis.get(`job:${postId}`); if (!jobId) { return c.json<UiResponse>({ showToast: { text: "No scheduled job found for this post", appearance: "neutral", }, }); } // Cancel the scheduled job await scheduler.cancelJob(jobId); // Clean up the stored job ID await redis.del(`job:${postId}`); return c.json<UiResponse>({ showToast: { text: "Successfully cancelled the scheduled job", appearance: "success", }, }); } catch (error) { console.error("Error cancelling job:", error); return c.json<UiResponse>({ showToast: { text: "Failed to cancel job", appearance: "neutral", }, }); }});
```
### Example: Storing a job ID when creating a job​
When you create a scheduled job, store its ID in Redis so you can reference it later
Hono
Express
/server/index.ts
```
type ScheduleActionRequest = { postId: string; delayMinutes: number };type ScheduleActionResponse = { jobId: string; message: string };app.post("/api/schedule-action", async (c) => { const { postId, delayMinutes } = await c.req.json<ScheduleActionRequest>(); const runAt = new Date(Date.now() + delayMinutes * 60 * 1000); const scheduledJob: ScheduledJob = { id: `job-${postId}-${Date.now()}`, name: "one-off-task-example", data: { postId }, runAt, }; const jobId = await scheduler.runJob(scheduledJob); // Store the job ID in Redis for later cancellation await redis.set(`job:${postId}`, jobId); return c.json<ScheduleActionResponse>({ jobId, message: "Job scheduled successfully", });});
```
## List jobs​
This example shows how to handle a request within your server/index.ts to list your scheduled jobs and return them to the client.
Hono
Express
/server/index.ts
```
type ListJobsSuccessResponse = { status: "success"; jobs: (ScheduledJob | ScheduledCronJob)[]; count: number;};type ListJobsErrorResponse = { status: "error"; message: string };type ListJobsResponse = ListJobsSuccessResponse | ListJobsErrorResponse;app.get("/api/list-jobs", async (c) => { try { const jobs: (ScheduledJob | ScheduledCronJob)[] = await scheduler.listJobs(); console.log(`[LIST] Found ${jobs.length} scheduled jobs`); return c.json<ListJobsResponse>({ status: "success", jobs, count: jobs.length, }); } catch (error) { console.error(`[LIST] Error listing jobs:`, error); return c.json<ListJobsResponse>( { status: "error", message: error instanceof Error ? error.message : "Failed to list jobs", }, 500, ); }});
```
## Faster scheduler​
note
This feature is experimental, which means the design is not final but it's still available for you to use.
Scheduled jobs currently perform one scheduled run per minute. To go faster, you can now run jobs every second by adding seconds granularity to your cron expression.
```
await scheduler.runJob({ name: "run_every_30_seconds", cron: "*/30 * * * * *",});
```
How frequent a scheduled job runs will depend on how long the job takes to complete and how many jobs are running in parallel. This means a job may take a bit longer than scheduled, but the overall resolution should be better than a minute.
## Limitations​
Limits are per installation of an app:
An installation can have up to 10 live recurring actions.
The
```
runJob()
```
method enforces two rate limits when creating actions:
Creation rate: Up to 60 calls to
```
runJob()
```
per minute
Delivery rate: Up to 60 deliveries per minute
Previous
HTTP Fetch Policy
Next
Triggers
Scheduling recurring jobs
1. Add a recurring task to
```
devvit.json
```
2. Handle the event in your server
Scheduling one-off jobs at runtime
1. Add the tasks to
```
devvit.json
```
2. Schedule a job at runtime
Cancel a scheduled job
1. Add menu item to
```
devvit.json
```
2. Handle the menu action in your server
Example: Storing a job ID when creating a job
List jobs
Faster scheduler
Limitations
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 3.2 Triggers

Triggers | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Automation & Triggers
Triggers
On this page
# Triggers
Triggers allow your app to automatically respond to specific events or actions within a Reddit community. Use triggers to build automation, moderation, and engagement features that react to user or moderator activity.
## What are triggers?​
A trigger is an action you can build into your app that will occur automatically when a specified condition is met. For example, you can set up a trigger to respond when a new post is submitted, a comment is created, or a moderator takes action.
## Supported trigger types​
Event triggers let your app automatically respond to a user's or moderator's action. The following trigger types are supported:
```
onPostSubmit
```
```
onPostCreate
```
```
onPostUpdate
```
```
onPostReport
```
```
onPostDelete
```
```
onPostFlairUpdate
```
```
onCommentCreate
```
```
onCommentDelete
```
```
onCommentReport
```
```
onCommentSubmit
```
```
onCommentUpdate
```
```
onPostNsfwUpdate
```
```
onPostSpoilerUpdate
```
```
onAppInstall
```
```
onAppUpgrade
```
```
onModActions
```
```
onModMail
```
```
onAutomoderatorFilterPost
```
```
onAutomoderatorFilterComment
```
A full list of events and their payloads can be found in the EventTypes documentation. For more details on Mod specific actions, see ModActions and ModMail.
## Setting up triggers​
### 1. Add triggers and endpoints to devvit.json​
Declare the triggers and their corresponding endpoints in your
```
devvit.json
```
:
```
"triggers": { "onAppUpgrade": "/internal/on-app-upgrade", "onCommentCreate": "/internal/on-comment-create", "onPostSubmit": "/internal/on-post-submit"}
```
### 2. Handle trigger events in your server logic​
Listen for the events in your server and access the data passed into the request:
Hono
Express
server/index.ts
```
import type { OnAppUpgradeRequest, OnCommentCreateRequest, OnPostSubmitRequest, TriggerResponse,} from '@devvit/web/shared';app.post('/internal/on-app-upgrade', async (c) => { console.log('Handle event for on-app-upgrade!'); const input = await c.req.json<OnAppUpgradeRequest>(); const installer = input.installer; console.log('Installer:', JSON.stringify(installer, null, 2)); return c.json<TriggerResponse>({ status: 'ok' });});app.post('/internal/on-comment-create', async (c) => { console.log('Handle event for on-comment-create!'); const input = await c.req.json<OnCommentCreateRequest>(); const comment = input.comment; const author = input.author; console.log('Comment:', JSON.stringify(comment, null, 2)); console.log('Author:', JSON.stringify(author, null, 2)); return c.json<TriggerResponse>({ status: 'ok' });});app.post('/internal/on-post-submit', async (c) => { console.log('Handle event for on-post-submit!'); const input = await c.req.json<OnPostSubmitRequest>(); const post = input.post; const author = input.author; console.log('Post:', JSON.stringify(post, null, 2)); console.log('Author:', JSON.stringify(author, null, 2)); return c.json<TriggerResponse>({ status: 'ok' });});
```
## Best practices​
Avoid creating recursive triggers that could cause infinite loops or crashes (for example, a comment trigger that creates a comment).
Always check the event payload to ensure your app is not the source of the event before taking action.
Review the EventTypes documentation for details on event payloads.
Previous
Scheduler
Next
In-App Purchases Overview
What are triggers?
Supported trigger types
Setting up triggers
1. Add triggers and endpoints to
```
devvit.json
```
2. Handle trigger events in your server logic
Best practices
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 5.1 Creating a Custom Post

Creating a Custom Post | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Post Creation & Navigation
Creating a Custom Post
On this page
# Creating a Custom Post
Redditors interact with your app through custom posts. To create a custom post, you’ll define the entry points in
```
devvit.json,
```
then use
```
submitCustomPost
```
to create a post that references one of those entry points.
## How it Works​
Each key in the
```
entrypoints
```
object (e.g. "default", "game") maps to an HTML file in your build output. When you call
```
submitCustomPost
```
, the entry parameter references one of these keys.
```
// devvit.json default template... "name": "test-custom-post", "post": { "dir": "dist/client", "entrypoints": { "default": { "entry": "splash.html" }, "game": { "entry": "game.html" } } }...
```
```
import { reddit } from '@devvit/web/server';export const createPost = async () => { return await reddit.submitCustomPost({ title: 'Example title for post', entry: 'default' // default });};
```
```
submitCustomPost
```
accepts the following optional parameters:
Parameter
Description
```
entry
```
Key of the entrypoint defined in
```
devvit.json
```
```
postData
```
Updates post data after creation
```
textFallback
```
Specifies alternative text content
```
userGeneratedContent
```
Enables user-generated content
```
styles
```
Controls post appearance in the Reddit UI. See Custom Post Styles
## Custom Post Styles​
Custom post styles let you control how a custom post looks in the Reddit UI, separate from the content inside your webview. You can:
Set the light mode or dark mode background color shown while the iframe loads
Choose the post height (for example,
```
“REGULAR”
```
or
```
“TALL”
```
) to control how much vertical space the post takes in the feed.
Provide a share image URL that’s used for link previews when the post is shared outside Reddit.
All style fields are optional. If you don’t set them, Reddit’s default settings apply.
### Properties​
Field
Type
Description
```
backgroundColor
```
```
string
```
(optional)
The default background color shown before the iframe content loads. Must be in
```
#RRGGBBAA
```
format (red, green, blue, alpha transparency). The value is case-insensitive. Defaults to transparent (
```
#00000000
```
).
```
backgroundColorDark
```
```
string
```
(optional)
The dark mode background color shown before the iframe content loads. Must be in
```
#RRGGBBAA
```
format with a leading
```
#
```
. Defaults to transparent (
```
#00000000
```
).
```
height
```
```
EntrypointHeight
```
enum (optional)
Post height.
```
TALL
```
= 512px,
```
REGULAR
```
= 320px. Width varies from ~288–880px depending on device and viewport. Defaults to
```
”TALL”
```
.
```
shareImageUrl
```
```
string
```
(optional)
The preview image URL used when the post is shared externally (for example, OpenGraph
```
og:image
```
).
Note: The image must be hosted on i.redd.it domain. Use the media upload plugin to upload a custom image. This only works if your app is on a public subreddit. Defaults to Reddit’s generic share image:
```
https://i.redd.it/o0h58lzmax6a1.png
```
.
### Creating a custom post with styles​
Set your custom post styles when you create a custom post:
```
await reddit.submitCustomPost({ "title": "Post with styles title", "styles": { "backgroundColor": "#FFFFFFFF", // white, fully opaque "backgroundColorDark": "#000000FF", // black, fully opaque "height": "TALL", "shareImageUrl": "https://reddi.it/12345.png" }})
```
Note: All style fields are optional.
### Updating styles​
Use
```
post.setCustomPostStyles()
```
to update styles on an existing post. Only include the fields you want to change. Omitted fields remain unchanged.
```
const post = await reddit.getPostById(context.postId);await post.setCustomPostStyles({ "styles": { "shareImageUrl": "https://example.com/new-preview.png" }});
```
Existing
```
background_color
```
,
```
background_color_dark
```
, and
```
height
```
values remain unchanged.
### Reading styles​
Use
```
post.getCustomPostStyles()
```
or
```
reddit.getPostStyles(id)
```
to read the styles on an existing post. Settings that haven’t been set yet will give you their default values.
```
const post = await reddit.getPostById(context.postId);const styles = await post.getCustomPostStyles();// Or, if you don't need the post object and want just the styles:const styles = await reddit.getPostStyles(context.postId);
```
# Best Practices
Color format: Always provide 8-digit hex with alpha:
```
#RRGGBBAA
```
.
```
RR
```
,
```
GG
```
,
```
BB
```
: 00–FF (0–255) color channels.
```
AA
```
: 00–FF alpha channel (
```
00
```
= fully transparent,
```
FF
```
= fully opaque).
Transparency: Use alpha (
```
AA
```
) to blend your app experience smoothly with Reddit backgrounds (for example,
```
#00000080
```
for semi-transparent black).
Dark mode: Always set
```
background_color_dark
```
when your iframe content has a dark theme so the pre-load state matches the final experience.
Height: Choose the
```
height
```
that best matches your UI. The platform will handle mapping that logical value to the correct pixel height for the client.
Share image: Must be hosted on i.redd.it (use the media upload plugin) and ensure the asset meets typical OpenGraph sizing and aspect-ratio expectations so it renders cleanly across platforms. This only works if your app is on a public subreddit.
Previous
Support this app
Next
Navigation
How it Works
Custom Post Styles
Properties
Creating a custom post with styles
Updating styles
Reading styles
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 5.2 Navigation

Navigation | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Post Creation & Navigation
Navigation
On this page
# Navigation
Use navigation functions to redirect users to Reddit content or external websites in response to user actions, such as button clicks. You can redirect to a
```
url
```
string or to objects such as
```
Subreddit
```
,
```
Post
```
, or
```
Comment
```
.
For most navigation interactions, use the direct client library functions. These provide immediate navigation and are perfect for user interactions within your app components.
warning
When linking to Reddit content, the navigation function requires the app account to have access to the content. If the app account does not have access, the redirect will fail.
## Basic navigation​
client/index.ts
```
import { navigateTo } from '@devvit/web/client';// Navigate to external URLsnavigateTo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');// Navigate to Reddit URLsnavigateTo('https://www.reddit.com/r/movies/comments/tzxev3/');// Navigate to Reddit objectsasync function goToPost() { const post = await fetch('/api/getPost').then(r => r.json()); navigateTo(post);}// Use in button handlers or user interactionsfunction handleNavigateClick() { navigateTo('https://www.reddit.com/r/webdev');}
```
### Parameters​
```
navigateTo(target)
```
```
target
```
: Either a URL string or a Reddit object (Subreddit, Post, Comment)
:::tip Menu response navigation
For navigation in menu response workflows (when you need server processing before navigation), see the Menu Actions documentation.
:::
## External URLs​
Users see a confirmation dialog before going to external URLs.
## Limitations​
```
url
```
must be http/https
```
url
```
must have a domain
Previous
Creating a Custom Post
Next
Toasts
Basic navigation
Parameters
External URLs
Limitations
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 5.3 Toasts

Toasts | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Post Creation & Navigation
Toasts
On this page
# Toasts
Display temporary notification messages to users at the bottom of the screen.
## Overview​
Toasts are brief, non-intrusive messages that appear temporarily at the bottom of the screen to provide feedback to users about their actions. They automatically disappear after a few seconds and are ideal for confirming successful operations or displaying status updates.
For most toast interactions, use the direct client library functions. These provide immediate feedback and are perfect for user interactions within your app components.
note
Toasts will not work from scheduled jobs or triggers.
## Toast appearance types​
Appearance
Description
```
neutral
```
Default gray appearance for general notifications
```
success
```
Green appearance for successful operations
## Basic toast usage​
```
import { showToast } from '@devvit/web/client';// Simple text toastshowToast('Operation completed successfully!');// Toast with custom appearanceshowToast({ text: 'Data saved successfully!', appearance: 'success', // 'neutral' | 'success'});// Use in button handlers or user interactionsfunction handleButtonClick() { try { // Perform some operation processUserData(); showToast({ text: 'Your data has been processed!', appearance: 'success' }); } catch (error) { showToast('Something went wrong. Please try again.'); }}
```
### Parameters​
```
showToast(textOrToast)
```
```
textOrToast
```
: Either a string message or a
```
Toast
```
object
Toast Object Properties:
```
text
```
(string): The message to display
```
appearance
```
(string, optional): The visual style (
```
'neutral'
```
|
```
'success'
```
). Defaults to
```
'neutral'
```
:::tip Menu response toasts
For toasts in menu response workflows (when you need server processing before showing toasts), see the Menu Actions documentation.
:::
## Best practices​
Keep toast messages concise and clear
Avoid showing multiple toasts in quick succession
Don't rely on toasts for critical information that users must see
Previous
Navigation
Next
Menu actions
Overview
Toast appearance types
Basic toast usage
Parameters
Best practices
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 5.4 Menu actions

Menu actions | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Post Creation & Navigation
Menu actions
On this page
# Menu actions
Add an item to the three dot menu for posts, comments, or subreddits. Menu actions can perform immediate client effects or trigger server processing followed by client effects.
## Basic menu actions​
For most menu actions, use direct client effects. These provide immediate responses and are perfect for simple actions that don't require server processing.
Menu items defined in devvit.json:
devvit.json
```
{ "menu": { "items": [ { "description": "Show user information", "endpoint": "/internal/menu/show-info", "location": "post" } ] }}
```
Simple endpoint with direct client effects:
Hono
Express
server/index.ts
```
import type { MenuItemRequest, UiResponse } from "@devvit/web/shared";app.post("/internal/menu/show-info", async (c) => { const _input = await c.req.json<MenuItemRequest>(); // Simple actions don't need server processing return c.json<UiResponse>({ showToast: "Menu action clicked!", });});
```
## Supported contexts​
You can decide where the menu action shows up by specifying the location property.
Property
Values
Description
location (required)
```
comment
```
,
```
post
```
,
```
subreddit
```
Determines where the menu action appears.
postFilter (optional)
```
currentApp
```
Shows the action created by your app. The default is no filtering.
forUserType (optional)
```
moderator
```
Specifies the user types that can see the menu action. The default is everyone.
note
For moderator permission security, when opening a form from a menu action with
```
forUserType: moderator
```
, the user initiating the action must complete all actions within 10 minutes.
## Menu responses​
In Devvit Web, your menu item should respond with a client side effect to give feedback to users. This is available as a UIResponse as you do not have access to the
```
@devvit/web/client
```
library from your server endpoints.
Menu items with server processing:
devvit.json
```
{ "menu": { "items": [ { "label": "Process and validate data", "endpoint": "/internal/menu/complex-action", "forUserType": "moderator", "location": "subreddit" } ] }}
```
Hono
Express
server/index.ts
```
import type { MenuItemRequest, UiResponse } from "@devvit/web/shared";app.post("/internal/menu/complex-action", async (c) => { const _input = await c.req.json<MenuItemRequest>(); try { // Perform server-side processing const userData = await validateAndProcessData(); // Show form with server-fetched data return c.json<UiResponse>({ showForm: { name: "processForm", form: { fields: [ { type: "string", name: "processedData", label: "Processed Data", }, ], }, data: { processedData: userData.processed }, }, }); } catch (error) { return c.json<UiResponse>({ showToast: "Processing failed. Please try again.", }); }});
```
### Menu response examples​
Menu responses can trigger any client effect after server processing:
Show toast after processing:
Hono
Express
```
return c.json({ showToast: { text: "Processing completed!", appearance: "success", },});
```
Navigate after data fetching:
Hono
Express
```
const post = await reddit.getPostById(postId);return c.json({ navigateTo: post,});
```
Chain multiple forms:
Hono
Express
```
// First form response leads to second formreturn c.json({ showForm: { name: 'secondForm', form: { fields: [...] }, data: { fromStep1: processedData } }});
```
## Limitations​
A sort order of actions in the context menu can't be specified.
The context, name, and description fields do not support dynamic logic.
Previous
Toasts
Next
Settings and Secrets
Basic menu actions
Supported contexts
Menu responses
Menu response examples
Limitations
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 5.5 Settings and Secrets

Settings and Secrets | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Post Creation & Navigation
Settings and Secrets
On this page
# Settings and Secrets
Configure your app with settings that can be customized per subreddit or globally across all installations. Settings allow moderators to customize app behavior for their subreddit, while secrets enable secure storage of sensitive data like API keys.
Settings come in two scopes:
Subreddit settings: Configurable by moderators for each installation
Global settings & Secrets: Set by developers and shared across all installations
warning
Local environment variables and
```
.env
```
files are read during playtesting only.
## Defining settings​
Define settings in your
```
devvit.json
```
file under the
```
settings
```
object. Settings are organized by scope:
```
global
```
for app-wide settings and secrets,
```
subreddit
```
for installation-specific settings.
devvit.json
```
{ "settings": { "global": { "apiKey": { "type": "string", "label": "API Key", "defaultValue": "", "isSecret": true }, "environment": { "type": "select", "label": "Environment", "options": [ { "label": "Production", "value": "production" }, { "label": "Development", "value": "development" } ], "defaultValue": "production" } }, "subreddit": { "welcomeMessage": { "type": "string", "label": "Welcome Message", "validationEndpoint": "/internal/settings/validate-message", "defaultValue": "Welcome to our community!" }, "enabledFeatures": { "type": "multiSelect", "label": "Enabled Features", "options": [ { "label": "Auto-moderation", "value": "automod" }, { "label": "Welcome posts", "value": "welcome" }, { "label": "Statistics tracking", "value": "stats" } ], "defaultValue": ["welcome"] } } }}
```
note
After defining settings in
```
devvit.json
```
, you must build your app (
```
npm run dev
```
) before you can set secrets via the CLI.
## Setting types​
The following setting types are supported:
string: Text input field
boolean: Toggle switch
number: Numeric input
select: Dropdown selection (single choice)
multiSelect: Multiple choice dropdown
## Managing secrets​
Secrets are global settings marked with
```
isSecret: true
```
. They're encrypted and can only be set by developers via the CLI.
### Listing secrets​
View all defined secrets in your app:
```
npx devvit settings listKey Label Is this a secret? Type────────── ─────────── ───────────────── ──────apiKey API Key true STRINGenvironment Environment false SELECT
```
### Setting secret values​
Only app developers can set secret values:
```
npx devvit settings set apiKey? Enter the value you would like to assign to the variable apiKey: <value>Updating app settings... ✅Successfully added app settings for apiKey!
```
warning
At least one app installation is required before you can store secrets via the CLI. Run
```
npm run dev
```
to start your first installation.
## Accessing settings in your app​
Settings can be retrieved from within your app.
Hono
Express
server/index.ts
```
import { settings } from '@devvit/web/server';type ProcessResponse = { success: true };// Get a single settingconst apiKey = await settings.get('apiKey');// Get multiple settingsconst [welcomeMessage, features] = await Promise.all([ settings.get('welcomeMessage'), settings.get('enabledFeatures')]);// Use in an endpointapp.post('/api/process', async (c) => { const apiKey = await settings.get('apiKey'); const environment = await settings.get('environment'); const response = await fetch('https://api.example.com/endpoint', { headers: { 'Authorization': `Bearer ${apiKey}`, 'X-Environment': environment } }); return c.json<ProcessResponse>({ success: true });});
```
## Input validation​
Validate user input to ensure it meets your requirements before saving. Define a validation endpoint in your
```
devvit.json
```
and implement it in your server:
devvit.json
```
{ "settings": { "subreddit": { "minimumAge": { "type": "number", "label": "Minimum Account Age (days)", "validationEndpoint": "/internal/settings/validate-age", "defaultValue": 7 } } }}
```
Hono
Express
server/index.ts
```
import type { SettingsValidationRequest, SettingsValidationResponse } from '@devvit/web/shared';app.post('/internal/settings/validate-age', async (c) => { const { value } = await c.req.json<SettingsValidationRequest<number>>(); if (!value || value < 0) { return c.json<SettingsValidationResponse>({ success: false, error: 'Age must be a positive number', }); } if (value > 365) { return c.json<SettingsValidationResponse>({ success: false, error: 'Maximum age is 365 days', }); } return c.json<SettingsValidationResponse>({ success: true });});
```
## Subreddit settings UI​
Once your app is installed, moderators can configure subreddit settings through the Install Settings page. These settings are scoped to the specific subreddit where the app is installed.
Moderators will see all non-secret settings defined for the subreddit scope and can update them as needed. Changes are saved immediately and available to your app.
## Complete example​
Here's a complete example showing both secrets and subreddit settings in action:
devvit.json
```
{ "settings": { "global": { "openaiApiKey": { "type": "string", "label": "OpenAI API Key", "isSecret": true, "defaultValue": "" } }, "subreddit": { "aiModel": { "type": "select", "label": "AI Model", "options": [ { "label": "GPT-4", "value": "gpt-4" }, { "label": "GPT-3.5", "value": "gpt-3.5-turbo" } ], "defaultValue": "gpt-3.5-turbo" }, "maxTokens": { "type": "number", "label": "Max Response Tokens", "validationEndpoint": "/internal/settings/validate-tokens", "defaultValue": 150 } } }}
```
Hono
Express
server/index.ts
```
import type { JsonObject, JsonValue } from '@devvit/web/shared';import { settings } from '@devvit/web/server';type GenerateRequest = { messages: JsonValue };type GenerateResponse = JsonObject;app.post('/api/generate', async (c) => { const [apiKey, model, maxTokens] = await Promise.all([ settings.get('openaiApiKey'), settings.get('aiModel'), settings.get('maxTokens') ]); const { messages } = await c.req.json<GenerateRequest>(); const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, }, body: JSON.stringify({ model, max_tokens: maxTokens, messages, }), }); const data = (await response.json()) as GenerateResponse; return c.json<GenerateResponse>(data);});
```
## Limitations​
Secrets can only be global
Secrets can only be set via CLI by app developers
Setting values are currently not fully surfaced in the CLI
Maximum of 2KB per setting value
Previous
Menu actions
Next
Setting up view modes and entry points
Defining settings
Setting types
Managing secrets
Listing secrets
Setting secret values
Accessing settings in your app
Input validation
Subreddit settings UI
Complete example
Limitations
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 5.6.1 View Modes, Launch Screens, Entry Points

View Modes, Launch Screens, and Entry Points | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Post Creation & Navigation
Launch Screen
View Modes, Launch Screens, and Entry Points
# View Modes, Launch Screens, and Entry Points
Devvit’s interactive framework gives you powerful ways to shape how users experience apps, from launch screen to expanded screen viewing. With view modes, HTML-based launch screens, and multiple entry points, you can design apps that feel native and respond to how users interact across the Reddit platform.
View modes define how your app appears:
Inline mode loads your app’s web view directly inside the post unit, either in the feed or on the post details page. Users can interact immediately without additional taps or page loads.
Expanded mode opens your app or game in a larger, full-screen view, ideal for immersive experiences such as games, creative tools, or detailed interactions on mobile.
Launch screens are the first thing users see before your main app loads. These HTML-based screens give you complete control over their design, animation, and loading behavior using the same tools and styles as your app itself.
This is an example of an inline launch screen:
Entry points act as a router that organizes your app across different view modes. Each entry point specifies the initial HTML file for the specific context. A user might experience your app inline, when it’s embedded in a post, or launch it in expanded mode for a larger, full-screen mobile experience.
Previous
Setting up view modes and entry points
Next
Setting up view modes and entry points
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 5.6.2 Setting up View Modes and Entry Points

Setting up view modes and entry points | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Post Creation & Navigation
Setting up view modes and entry points
On this page
# Setting up view modes and entry points
## View modes​
Devvit apps support two view modes:
Inline Mode
What it is: Your app loads directly within the post unit
User experience: Users see your app content immediately without clicking
Use case: Preview screens, game menus, leaderboards, or any content that works well in a post-sized container
Requirements: Only respond to taps and clicks, load quickly, and respect post boundaries
Expanded Mode
What it is: Your app displays in a larger modal (web) or full screen (mobile)
User experience: Users click to enter a dedicated experience
Use case: Full games, longer load times, detailed interfaces, or any content that needs more space or full gesture support
Trigger: User-initiated only (button click, gesture, etc.)
## Multiple entry points​
Multiple entry points let the user start the game from different contexts or states. For example, you can have a button that launches into a leaderboard view and another for a specific game mode, each of these would be configured as an entry point for your app. Define multiple entry points in your
```
devvit.json
```
. If you use the Devvit Vite plugin, it automatically infers the client build inputs from these entrypoints, so you don't need to maintain a custom Rollup
```
input
```
list.
devvit.json
```
{ "post": { "dir": "dist/client", "entrypoints": { "default": { "entry": "src/client/preview.html", "height": "regular", "inline": true }, "game": { "entry": "src/client/game.html" }, "leaderboard": { "entry": "src/client/leaderboard.html" } } }}
```
vite.config.ts
```
import { defineConfig } from "vite";import react from "@vitejs/plugin-react";import tailwind from "@tailwindcss/vite";import { devvit } from "@devvit/start/vite";export default defineConfig({ plugins: [react(), tailwind(), devvit()],});
```
File Structure Example
```
your-app/├── devvit.json├── vite.config.ts├── src/│ ├── server/│ │ └── index.ts│ └── client/│ ├── preview.html│ ├── game.html│ ├── leaderboard.html│ └── styles.css└── dist/ // Built files after compilation └── client/ // This is what "dir" points to ├── preview.html ├── game.html ├── leaderboard.html └── styles.css
```
The
```
dir
```
property specifies where your built client files are located. With the Devvit Vite plugin, the
```
entry
```
values point at your source HTML files (for example
```
src/client/preview.html
```
), and the plugin outputs the matching files into
```
dist/client
```
during
```
vite build
```
.
### Creating posts with specific entry points​
Use the
```
entry
```
parameter when creating posts to specify which entry point from your
```
devvit.json
```
configuration to use. The entry value must match one of the keys defined in
```
post.entrypoints
```
.
server/index.ts
```
import { reddit } from '@devvit/web/server';// Create a post using the default entrypointasync function createDefaultPost(context: any) { return await reddit.submitCustomPost({ subredditName: context.subredditName!, title: 'Adventure Game', entry: 'default', postData: { gameState: 'menu', }, });}// Create a post using a specific entrypointasync function createGamePost(context: any) { return await reddit.submitCustomPost({ subredditName: context.subredditName!, title: 'Adventure Game', entry: 'game', // Must match a key in devvit.json entrypoints postData: { gameState: 'active', initialized: true, }, });}
```
How it works
If
```
entry
```
is not specified, the
```
default
```
entry point is used automatically.
The
```
entry
```
value must match a key defined in your
```
devvit.json post.entrypoints
```
object.
Each entry point can have its own HTML file and height setting.
Invalid entry point names will cause an error.
### Switching between view modes​
You can transition from inline mode to expanded mode with a different entry point, like this:
```
import { requestExpandedMode } from '@devvit/web/client';// Switch to the 'game' entrypoint in expanded modeconst handleStartGame = async (event: React.MouseEvent) => { try { await requestExpandedMode(event.nativeEvent, 'game'); } catch (error) { console.error('Failed to enter expanded mode:', error); }};
```
## Inline mode requirements​
All Devvit web view apps load in inline mode by default. Your app loads directly in the post unit without requiring users to click to expand.
Apps must meet these requirements for approval and featuring:
Performance
Optimize for mobile devices and slower connections
Load initial content in under 1 second
Achieve a Lighthouse score >80.
To find your Lighthouse score you can follow these steps:
Open your inline post
Open Developer Tools in Chrome and navigate to the elements tab
Find the Devvit web view element in the DOM and open it in a new tab
Open Developer Tools in the new tab and navigate to Lighthouse
Ensure you have mobile selected and select Analyze Page Load
Gesture compliance
Only tap or click input is allowed
No scroll traps or scroll hijacking
No zoom or pan interference
Users must be able to scroll past your post naturally
Responsive design
Content must work across all viewport sizes (use chrome devtools to test your app's responsiveness)
Keep in mind that the majority of users are on mobile devices
User-initiated expanded mode
Apps cannot auto-launch into expanded mode or auto-close without a user action
Must have explicit user interaction (clearly labeled button or action)
Default view should respect standard post boundaries
Safe use of sound
Audio should not play unless there is a user interaction
Include a button to mute in your game
Use the visibilityChange handler to mute any sounds if a user scrolls away
Previous
Settings and Secrets
Next
View Modes, Launch Screens, and Entry Points
View modes
Multiple entry points
Creating posts with specific entry points
Switching between view modes
Inline mode requirements
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 5.6.3 Launch Screen Customization

Launch Screen Customization | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Post Creation & Navigation
Launch Screen
Launch Screen Customization
On this page
# Launch Screen Customization
## Creating Your Launch (Preview) Screen​
Create an HTML file that serves as your app's launch screen in inline mode. This is what users see immediately when they encounter your post. Templates include a performant and compliant preview screen.
preview.html
```
<html> <head> <meta charset="UTF-8" /> <meta name="viewport" content="width=device-width, initial-scale=1.0" /> <title>My Game</title> <script src="preview.js"></script> </head> <body> <div class="preview-container"> <h1>Adventure Game</h1> <p>Tap to play in fullscreen</p> <button id="play-button">Play Now</button> </div> </body></html>
```
preview.js
```
import { requestExpandedMode } from '@devvit/web/client';document.addEventListener('DOMContentLoaded', () => { const playButton = document.getElementById('play-button'); playButton.addEventListener('click', async (event) => { try { await requestExpandedMode(event, 'game'); } catch (error) { console.error('Failed to enter expanded mode:', error); } });});
```
## API Reference​
### requestExpandedMode()​
Requests expanded mode for the web view. This displays the web view in a larger modal presentation on web and full screen on mobile.
```
import { requestExpandedMode } from '@devvit/web/client';// Must be called from a trusted event (click, touch, etc.)await requestExpandedMode(event, 'game');
```
Parameters
```
event
```
(PointerEvent): The gesture that triggered the request, must be a trusted event
```
entry
```
(string): The destination URI name (e.g.,
```
splash
```
or
```
game
```
). Entry names are the
```
devvit.json post.entrypoints
```
keys
### getWebViewMode()​
Get the current web view mode state.
```
import { getWebViewMode } from '@devvit/web/client';const currentMode = getWebViewMode(); // Returns 'inline' | 'expanded'if (currentMode === 'expanded') { // Show expanded UI} else { // Show inline UI}
```
### Mode Change Events​
Listen for mode changes to update your UI.
```
import { addWebViewModeListener, removeWebViewModeListener } from '@devvit/web/client';function useWebViewMode() { const [mode, setMode] = useState(getWebViewMode()); useEffect(() => { const handleModeChange = (newMode: 'inline' | 'expanded') => { setMode(newMode); }; addWebViewModeListener(handleModeChange); return () => removeWebViewModeListener(handleModeChange); }, []); return mode;}
```
## Complete Example​
game.tsx
```
import React, { useState, useEffect } from 'react';import { getWebViewMode, requestExpandedMode, exitExpandedMode, addWebViewModeListener, removeWebViewModeListener,} from '@devvit/web/client';export function GameApp() { const [mode, setMode] = useState(getWebViewMode()); const [gameStarted, setGameStarted] = useState(false); useEffect(() => { const handleModeChange = (newMode: 'inline' | 'expanded') => { setMode(newMode); // Pause game when exiting expanded mode if (newMode === 'inline' && gameStarted) { pauseGame(); } }; addWebViewModeListener(handleModeChange); return () => removeWebViewModeListener(handleModeChange); }, [gameStarted]); const handlePlayClick = async (event: React.MouseEvent) => { try { await requestExpandedMode(event.nativeEvent, 'game'); setGameStarted(true); } catch (error) { console.error('Could not enter expanded mode:', error); // Fallback: start game inline setGameStarted(true); } }; const handleExitClick = async (event: React.MouseEvent) => { try { await exitExpandedMode(event.nativeEvent); } catch (error) { console.error('Could not exit expanded mode:', error); } }; if (mode === 'inline') { return ( <div className="inline-view"> <h2>Adventure Game</h2> <p>Tap to play in fullscreen</p> <button onClick={handlePlayClick} className="play-button"> Play Now </button> </div> ); } return ( <div className="expanded-view"> <button onClick={handleExitClick} className="exit-button"> Exit </button> <GameCanvas /> </div> );}
```
Previous
Setting up view modes and entry points
Next
Overview
Creating Your Launch (Preview) Screen
API Reference
requestExpandedMode()
getWebViewMode()
Mode Change Events
Complete Example
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 6.1 Realtime Apps

Overview | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Realtime Apps
Overview
On this page
# Overview
Create live and event-driven interactive posts. Realtime provides a set of primitives that lets you build interactive posts that are:
Live. Users engaging with the same interactive post see each others’ changes without any observable lag.
Event-driven. Posts render automatically in response to server events.
Synced. Using realtime with Redis lets you build persistent community experiences that are backed by high performance data synchronization.
Realtime is supported in Devvit Web applications.
# Realtime in Devvit Web
This guide walks through step-by-step instructions on how to set up Realtime in a Devvit Web application
## Overview​
The realtime client allows you to:
Connect to realtime channels for receiving messages
Handle connection lifecycle events (connect/disconnect)
Process incoming messages with custom logic
Manage multiple channel subscriptions
Disconnect from channels when no longer needed
## Architecture​
Realtime functionality in Devvit follows a client/server architecture:
Client-side (connectRealtime): Subscribe to channels and receive messages
Server-side (realtime.send): Send messages to channels
This separation ensures that message sending is controlled by server-side logic while clients can freely subscribe to channels they're interested in.
## Client-side API reference​
### connectRealtime​
Connects to a realtime channel for receiving messages.
client/index.ts
```
import { connectRealtime } from '@devvit/web/client';const connection = await connectRealtime({ channel: 'my-channel', onConnect: (channel) => { console.log(`Connected to ${channel}`); }, onDisconnect: (channel) => { console.log(`Disconnected from ${channel}`); }, onMessage: (data) => { console.log('Received message:', data); },});
```
#### Parameters​
```
opts
```
- Connection options object
```
channel
```
(string) - The name of the channel to connect to. Note, you cannot use the
```
:
```
character in the channel name
```
onConnect?
```
(function) - Optional callback called when connection is established
```
onDisconnect?
```
(function) - Optional callback called when connection is lost
```
onMessage
```
(function) - Required callback called when a message is received
#### Returns​
A
```
Connection
```
object with a
```
disconnect()
```
method.
### Connection​
A connection object returned by
```
connectRealtime()
```
.
#### Methods​
##### disconnect()​
Disconnects from the realtime channel.
```
await connection.disconnect();
```
This method:
Removes the channel from active subscriptions
Cleans up event listeners
Calls the
```
onDisconnect
```
callback if provided
## Server-side API reference​
### Realtime plugin​
The server-side plugin for sending messages to realtime channels.
server/index.ts
```
import { realtime } from '@devvit/web/server';// Send a message to a channelawait realtime.send('my-channel', { type: 'user-joined', userId: '123',});
```
#### Methods​
##### send(channel: string, msg: JSONValue): Promise​
Sends a message to a specific channel.
```
channel
```
(string) - The name of the channel to send the message to
```
msg
```
(JSONValue) - The message data to send
## Usage examples​
### Client-side: basic channel connection​
client/index.ts
```
import { connectRealtime } from '@devvit/web/client';// Connect to a channelconst connection = await connectRealtime({ channel: 'user-updates', onMessage: (data) => { // Handle incoming messages console.log('User update:', data); },});// Later, disconnect when doneawait connection.disconnect();
```
### Client-side: connection lifecycle management​
client/index.ts
```
import { connectRealtime } from '@devvit/web/client';const connection = await connectRealtime({ channel: 'live-chat', onConnect: (channel) => { console.log(`Connected to ${channel}`); // Update UI to show connected state setIsConnected(true); }, onDisconnect: (channel) => { console.log(`Disconnected from ${channel}`); // Update UI to show disconnected state setIsConnected(false); }, onMessage: (data) => { // Process chat messages addMessageToChat(data); },});
```
### Server-side: sending messages​
server/index.ts
```
import { realtime } from '@devvit/web/server';// Send a simple messageawait realtime.send('notifications', 'New user joined!');// Send a structured messageawait realtime.send('game-updates', { type: 'score-update', playerId: 'user123', score: 1500, timestamp: Date.now(),});
```
Previous
Launch Screen Customization
Next
Reddit API Overview
Overview
Architecture
Client-side API reference
connectRealtime
Connection
Server-side API reference
Realtime plugin
Usage examples
Client-side: basic channel connection
Client-side: connection lifecycle management
Server-side: sending messages
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.1 API Overview

Reddit API Overview | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Reddit API Overview
On this page
# Reddit API Overview
The Reddit API allows you to read and write Reddit content such as posts / comments / upvotes, in order to integrate your app's behavior with the content of the community it's installed in.
note
Unlike traditional Reddit API usage, you don't need to create an app at reddit.com/prefs/apps or manage API keys. Devvit handles authentication automatically when you enable the
```
reddit
```
permission in your app.
## Private user data​
Devvit apps cannot access certain private user data. This data is private to the logged-in user and is not exposed through the Devvit platform:
Subscribed subreddits - The list of subreddits a user is subscribed to
Upvoted and downvoted content - Posts and comments the user has voted on
Saved content - Posts and comments the user has saved
Recently viewed posts - The user's browsing history
Private profile information - Any profile data that is not publicly visible
Follows and friends - The list of users someone follows (on reddit.com) or has friended (on Old Reddit)
## The Reddit client​
Here's how to obtain a reference to the Reddit client
devvit.json
```
{ "permissions": { "reddit": true }}
```
server/index.ts
```
import { reddit } from '@devvit/reddit';
```
## Reddit Thing IDs​
Reddit uses prefixed IDs (called "things") to identify different types of content:
Prefix
Type
Example
Description
```
t1_
```
Comment
```
t1_abc123
```
A comment on a post or reply to another comment
```
t2_
```
User
```
t2_xyz789
```
A Reddit user account
```
t3_
```
Post
```
t3_def456
```
A post
```
t4_
```
Message
```
t4_ghi012
```
A private message
```
t5_
```
Subreddit
```
t5_jkl345
```
A subreddit community
These IDs are returned by API methods and used when referencing specific content:
```
// Get a post by its full IDconst post = await reddit.getPostById('t3_abc123');// Get a comment by its full ID const comment = await reddit.getCommentById('t1_xyz789');// A comment's parentId can be either a post (t3_) or another comment (t1_)const parentId = comment.parentId; // 't3_abc123' or 't1_def456'
```
## Example usage​
### Submitting a post​
```
import { Devvit } from '@devvit/public-api';import { context, reddit } from '@devvit/web/server';export const createPost = async () => { const { subredditName } = context; if (!subredditName) { throw new Error('subredditName is required'); } return await reddit.submitCustomPost({ userGeneratedContent: { text: 'Hello there! This is a post from a Devvit app', }, subredditName: subredditName, title: 'New Post', entry: 'default', });};
```
### Submitting a comment​
note
Auto-comments should be used to spark conversation in the post comments, but you should avoid lower-signal updates (e.g., level/progress pings).
```
import { context, reddit } from '@devvit/web/server';export const createComment = async () => { const { subredditName } = context; if (!subredditName) { throw new Error('subredditName is required'); } reddit.submitComment({ postId: 't3_123456', // Replace with the actual post ID text: 'This is a comment from a Devvit app', runAs: 'USER' // Optional: specify the user to run as });};
```
Previous
Overview
Next
Reddit API Client
Private user data
The Reddit client
Reddit Thing IDs
Example usage
Submitting a post
Submitting a comment
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.2 API Client

RedditAPIClient | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Reddit API Client
On this page
# RedditAPIClient
@devvit/public-api v0.12.20-dev
# Class: RedditAPIClient
The Reddit API Client
To use the Reddit API Client, add it to the plugin configuration at the top of the file.
## Example​
```
Devvit.configure({ redditAPI: true, // other plugins})// use within one of our capability handlers e.g. Menu Actions, Triggers, Scheduled Job Type, etcasync (event, context) => { const subreddit = await context.reddit.getSubredditById(context.subredditId); context.reddit.submitPost({ subredditName: subreddit.name, title: 'test post', text: 'test body', }) // additional code}
```
## Constructors​
### new RedditAPIClient()​
new RedditAPIClient(
```
metadata
```
):
```
RedditAPIClient
```
#### Parameters​
##### metadata​
```
Metadata
```
#### Returns​
```
RedditAPIClient
```
## Accessors​
### modMail​
#### Get Signature​
get modMail():
```
ModMailService
```
Get ModMail API object
##### Example​
```
await reddit.modMail.reply({ body: "Here is my message", conversationId: "abcd42";})
```
##### Returns​
```
ModMailService
```
## Methods​
### addEditorToWikiPage()​
addEditorToWikiPage(
```
subredditName
```
,
```
page
```
,
```
username
```
):
```
Promise
```
<
```
void
```
>
Add an editor to a wiki page.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit the wiki is in.
##### page​
```
string
```
The name of the wiki page to add the editor to.
##### username​
```
string
```
The username of the user to add as an editor.
#### Returns​
```
Promise
```
<
```
void
```
>
### addModNote()​
addModNote(
```
options
```
):
```
Promise
```
<
```
ModNote
```
>
Add a mod note.
#### Parameters​
##### options​
```
Prettify
```
Options for the request
#### Returns​
```
Promise
```
<
```
ModNote
```
>
A Promise that resolves if the mod note was successfully added.
### addRemovalNote()​
addRemovalNote(
```
options
```
):
```
Promise
```
<
```
void
```
>
Add a mod note for why a post or comment was removed
#### Parameters​
##### options​
```
Prettify
```
#### Returns​
```
Promise
```
<
```
void
```
>
### addSubredditRemovalReason()​
addSubredditRemovalReason(
```
subredditName
```
,
```
options
```
):
```
Promise
```
<
```
string
```
>
Add a removal reason to a subreddit.
#### Parameters​
##### subredditName​
```
string
```
Name of the subreddit (e.g.
```
askReddit
```
or
```
r/askReddit
```
).
##### options​
Options.
###### message​
```
string
```
The message associated with the removal reason.
###### title​
```
string
```
The title of the removal reason.
#### Returns​
```
Promise
```
<
```
string
```
>
Removal Reason ID
#### Example​
```
const newReason = await reddit.addSubredditRemovalReasons( 'askReddit', { title: 'Spam', message: 'This is spam!' });console.log(newReason.id)
```
### addWidget()​
addWidget(
```
widgetData
```
):
```
Promise
```
<
```
Widget
```
>
Add a widget to a subreddit.
#### Parameters​
##### widgetData​
```
AddWidgetData
```
The data for the widget to add.
#### Returns​
```
Promise
```
<
```
Widget
```
>
The added Widget object.
### addWikiContributor()​
addWikiContributor(
```
username
```
,
```
subredditName
```
):
```
Promise
```
<
```
void
```
>
Add a user as a wiki contributor for a subreddit.
#### Parameters​
##### username​
```
string
```
The username of the user to add as a wiki contributor. e.g. 'spez'
##### subredditName​
```
string
```
The name of the subreddit to add the user as a wiki contributor. e.g. 'memes'
#### Returns​
```
Promise
```
<
```
void
```
>
### approve()​
approve(
```
id
```
):
```
Promise
```
<
```
void
```
>
Approve a post or comment.
#### Parameters​
##### id​
```
string
```
The id of the post (t3_) or comment (t1_) to approve.
#### Returns​
```
Promise
```
<
```
void
```
>
#### Example​
```
await reddit.approve('t3_123456');await reddit.approve('t1_123456');
```
### approveUser()​
approveUser(
```
username
```
,
```
subredditName
```
):
```
Promise
```
<
```
void
```
>
Approve a user to post in a subreddit.
#### Parameters​
##### username​
```
string
```
The username of the user to approve. e.g. 'spez'
##### subredditName​
```
string
```
The name of the subreddit to approve the user in. e.g. 'memes'
#### Returns​
```
Promise
```
<
```
void
```
>
### banUser()​
banUser(
```
options
```
):
```
Promise
```
<
```
void
```
>
Ban a user from a subreddit.
#### Parameters​
##### options​
```
BanUserOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
void
```
>
### banWikiContributor()​
banWikiContributor(
```
options
```
):
```
Promise
```
<
```
void
```
>
Ban a user from contributing to the wiki on a subreddit.
#### Parameters​
##### options​
```
BanWikiContributorOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
void
```
>
### createPostFlairTemplate()​
createPostFlairTemplate(
```
options
```
):
```
Promise
```
<
```
FlairTemplate
```
>
Create a post flair template for a subreddit.
#### Parameters​
##### options​
```
CreateFlairTemplateOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
FlairTemplate
```
>
The created FlairTemplate object.
### createRule()​
createRule(
```
subredditName
```
,
```
options
```
):
```
Promise
```
<
```
void
```
>
Create a new rule in a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to add the rule to.
##### options​
```
CreateRuleOptions
```
#### Returns​
```
Promise
```
<
```
void
```
>
### createUserFlairTemplate()​
createUserFlairTemplate(
```
options
```
):
```
Promise
```
<
```
FlairTemplate
```
>
Create a user flair template for a subreddit.
#### Parameters​
##### options​
```
CreateFlairTemplateOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
FlairTemplate
```
>
The created FlairTemplate object.
### createWikiPage()​
createWikiPage(
```
options
```
):
```
Promise
```
<
```
WikiPage
```
>
Create a new wiki page for a subreddit.
#### Parameters​
##### options​
```
CreateWikiPageOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
WikiPage
```
>
The created WikiPage object.
### crosspost()​
crosspost(
```
options
```
):
```
Promise
```
<
```
Post
```
>
Crossposts a post to a subreddit.
#### Parameters​
##### options​
```
CrosspostOptions
```
Options for crossposting a post
#### Returns​
```
Promise
```
<
```
Post
```
>
A Promise that resolves to a Post object.
### deleteFlairTemplate()​
deleteFlairTemplate(
```
subredditName
```
,
```
flairTemplateId
```
):
```
Promise
```
<
```
void
```
>
Delete a flair template from a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to delete the flair template from.
##### flairTemplateId​
```
string
```
The ID of the flair template to delete.
#### Returns​
```
Promise
```
<
```
void
```
>
### deleteModNote()​
deleteModNote(
```
options
```
):
```
Promise
```
<
```
boolean
```
>
Delete a mod note.
#### Parameters​
##### options​
```
Prettify
```
Options for the request
#### Returns​
```
Promise
```
<
```
boolean
```
>
True if it was deleted successfully; false otherwise.
### deleteSubredditRemovalReason()​
deleteSubredditRemovalReason(
```
subredditName
```
,
```
reasonId
```
):
```
Promise
```
<
```
void
```
>
Delete a removal reason from a subreddit.
#### Parameters​
##### subredditName​
```
string
```
Name of the subreddit (e.g.
```
askReddit
```
or
```
r/askReddit
```
).
##### reasonId​
```
string
```
ID of the removal reason (from get or add).
#### Returns​
```
Promise
```
<
```
void
```
>
### deleteWidget()​
deleteWidget(
```
subredditName
```
,
```
widgetId
```
):
```
Promise
```
<
```
void
```
>
Delete a widget from a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to delete the widget from.
##### widgetId​
```
string
```
The ID of the widget to delete.
#### Returns​
```
Promise
```
<
```
void
```
>
### editFlairTemplate()​
editFlairTemplate(
```
options
```
):
```
Promise
```
<
```
FlairTemplate
```
>
Edit a flair template for a subreddit. This can be either a post or user flair template.
Note: If you leave any of the options fields as undefined, they will reset to their default values.
#### Parameters​
##### options​
```
EditFlairTemplateOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
FlairTemplate
```
>
The edited FlairTemplate object.
### getApprovedUsers()​
getApprovedUsers(
```
options
```
):
```
Listing
```
<
```
User
```
>
Get a list of users who have been approved to post in a subreddit.
#### Parameters​
##### options​
```
GetSubredditUsersOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
User
```
>
A Listing of User objects.
### getAppUser()​
getAppUser():
```
Promise
```
<
```
User
```
>
Get the user that the app runs as on the provided metadata.
#### Returns​
```
Promise
```
<
```
User
```
>
A Promise that resolves to a User object.
#### Example​
```
const user = await reddit.getAppUser(metadata);
```
### getBannedUsers()​
getBannedUsers(
```
options
```
):
```
Listing
```
<
```
User
```
>
Get a list of users who are banned from a subreddit.
#### Parameters​
##### options​
```
GetSubredditUsersOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
User
```
>
A Listing of User objects.
### getBannedWikiContributors()​
getBannedWikiContributors(
```
options
```
):
```
Listing
```
<
```
User
```
>
Get a list of users who are banned from contributing to the wiki on a subreddit.
#### Parameters​
##### options​
```
GetSubredditUsersOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
User
```
>
A Listing of User objects.
### getBestPosts()​
getBestPosts(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Get a list of best posts from the front page.
This method will get the front page for the app account by default.
To get the front page for a user, please contact Reddit.
#### Parameters​
##### options​
```
ListingFetchOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
Post
```
>
A Listing of Post objects.
#### Example​
```
const posts = await reddit.getBestPosts({ limit: 1000, pageSize: 100}).all();
```
### getCommentById()​
getCommentById(
```
id
```
):
```
Promise
```
<
```
Comment
```
>
Get a Comment object by ID
#### Parameters​
##### id​
```
string
```
The ID (starting with t1_) of the comment to retrieve. e.g. t1_1qjpg
#### Returns​
```
Promise
```
<
```
Comment
```
>
A Promise that resolves to a Comment object.
#### Example​
```
const comment = await reddit.getCommentById('t1_1qjpg');
```
### getComments()​
getComments(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Get a list of comments from a specific post or comment.
#### Parameters​
##### options​
```
GetCommentsOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
Comment
```
>
A Listing of Comment objects.
#### Example​
```
const comments = await reddit.getComments({ postId: 't3_1qjpg', limit: 1000, pageSize: 100}).all();
```
### getCommentsAndPostsByUser()​
getCommentsAndPostsByUser(
```
options
```
):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Get a list of posts and comments from a specific user.
#### Parameters​
##### options​
```
GetUserOverviewOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
A Listing of
```
Post
```
and
```
Comment
```
objects.
### getCommentsByUser()​
getCommentsByUser(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Get a list of comments by a specific user.
#### Parameters​
##### options​
```
GetCommentsByUserOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
Comment
```
>
A Listing of Comment objects.
### getControversialPosts()​
getControversialPosts(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Get a list of controversial posts from a specific subreddit.
#### Parameters​
##### options​
```
GetPostsOptionsWithTimeframe
```
Options for the request
#### Returns​
```
Listing
```
<
```
Post
```
>
A Listing of Post objects.
#### Example​
```
const posts = await reddit.getControversialPosts({ subredditName: 'memes', timeframe: 'day', limit: 1000, pageSize: 100}).all();
```
### getCurrentSubreddit()​
getCurrentSubreddit():
```
Promise
```
<
```
Subreddit
```
>
Retrieves the current subreddit.
#### Returns​
```
Promise
```
<
```
Subreddit
```
>
A Promise that resolves a Subreddit object.
#### Example​
```
const currentSubreddit = await reddit.getCurrentSubreddit();
```
### getCurrentSubredditName()​
getCurrentSubredditName():
```
Promise
```
<
```
string
```
>
Retrieves the name of the current subreddit.
#### Returns​
```
Promise
```
<
```
string
```
>
A Promise that resolves a string representing the current subreddit's name.
#### Example​
```
const currentSubredditName = await reddit.getCurrentSubredditName();
```
### getCurrentUser()​
getCurrentUser():
```
Promise
```
<
```
undefined
```
|
```
User
```
>
Get the current calling user.
Resolves to undefined for logged-out custom post renders.
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
User
```
>
A Promise that resolves to a User object or undefined
#### Example​
```
const user = await reddit.getCurrentUser();
```
### getCurrentUsername()​
getCurrentUsername():
```
Promise
```
<
```
undefined
```
|
```
string
```
>
Get the current calling user's username.
Resolves to undefined for logged-out custom post renders.
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
string
```
>
A Promise that resolves to a string representing the username or undefined
#### Example​
```
const username = await reddit.getCurrentUsername();
```
### getDuplicatesForPost()​
getDuplicatesForPost(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Get posts that shared the same link as the given post.
#### Parameters​
##### options​
```
GetDuplicatesOptions
```
Options for the request. Post ID is required, eveything else is optional.
#### Returns​
```
Listing
```
<
```
Post
```
>
A Listing of Post objects.
#### Example​
```
const duplicates = await reddit.getDuplicatesForPost({ postId: 't3_abc123', sort: 'num_comments', limit: 100}).all();
```
### getEdited()​
#### Call Signature​
getEdited(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Return a listing of things that have been edited recently.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"comment"
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getEdited();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getEdited({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getEdited(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Return a listing of things that have been edited recently.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"post"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getEdited();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getEdited({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getEdited(
```
options
```
):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things that have been edited recently.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"all"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getEdited();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getEdited({ type: "post"});console.log("Posts: ", await listing.all())
```
### getHotPosts()​
getHotPosts(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Get a list of hot posts from a specific subreddit.
#### Parameters​
##### options​
```
GetHotPostsOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
Post
```
>
A Listing of Post objects.
#### Example​
```
const posts = await reddit.getHotPosts({ subredditName: 'memes', timeframe: 'day', limit: 1000, pageSize: 100}).all();
```
### getMessages()​
getMessages(
```
options
```
):
```
Promise
```
<
```
Listing
```
<
```
PrivateMessage
```
>>
Get private messages sent to the currently authenticated user.
#### Parameters​
##### options​
```
Prettify
```
Options for the request
#### Returns​
```
Promise
```
<
```
Listing
```
<
```
PrivateMessage
```
>>
### getModerationLog()​
getModerationLog(
```
options
```
):
```
Listing
```
<
```
ModAction
```
>
Get the moderation log for a subreddit.
#### Parameters​
##### options​
```
GetModerationLogOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
ModAction
```
>
A Listing of ModAction objects.
#### Example​
```
const modActions = await reddit.getModerationLog({ subredditName: 'memes', moderatorUsernames: ['spez'], type: 'banuser', limit: 1000, pageSize: 100}).all();
```
### getModerators()​
getModerators(
```
options
```
):
```
Listing
```
<
```
User
```
>
Get a list of users who are moderators for a subreddit.
#### Parameters​
##### options​
```
GetSubredditUsersOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
User
```
>
A Listing of User objects.
### getModNotes()​
getModNotes(
```
options
```
):
```
Listing
```
<
```
ModNote
```
>
Get a list of mod notes related to a user in a subreddit.
#### Parameters​
##### options​
```
Prettify
```
Options for the request
#### Returns​
```
Listing
```
<
```
ModNote
```
>
A listing of ModNote objects.
### getModQueue()​
#### Call Signature​
getModQueue(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Return a listing of things requiring moderator review, such as reported things and items.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"comment"
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getModQueue();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getModQueue({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getModQueue(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Return a listing of things requiring moderator review, such as reported things and items.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"post"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getModQueue();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getModQueue({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getModQueue(
```
options
```
):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things requiring moderator review, such as reported things and items.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"all"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getModQueue();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getModQueue({ type: "post"});console.log("Posts: ", await listing.all())
```
### getMutedUsers()​
getMutedUsers(
```
options
```
):
```
Listing
```
<
```
User
```
>
Get a list of users who are muted in a subreddit.
#### Parameters​
##### options​
```
GetSubredditUsersOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
User
```
>
A listing of User objects.
### getNewPosts()​
getNewPosts(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Get a list of new posts from a specific subreddit.
#### Parameters​
##### options​
```
GetPostsOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
Post
```
>
A Listing of Post objects.
#### Example​
```
const posts = await reddit.getNewPosts({ subredditName: 'memes', limit: 1000, pageSize: 100}).all();
```
### getPostById()​
getPostById(
```
id
```
):
```
Promise
```
<
```
Post
```
>
Gets a Post object by ID
#### Parameters​
##### id​
```
string
```
#### Returns​
```
Promise
```
<
```
Post
```
>
A Promise that resolves to a Post object.
### getPostFlairTemplates()​
getPostFlairTemplates(
```
subredditName
```
):
```
Promise
```
<
```
FlairTemplate
```
[]>
Get the list of post flair templates for a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to get the post flair templates for.
#### Returns​
```
Promise
```
<
```
FlairTemplate
```
[]>
A Promise that resolves with an array of FlairTemplate objects.
### getPostsByUser()​
getPostsByUser(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Get a list of posts from a specific user.
#### Parameters​
##### options​
```
GetPostsByUserOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
Post
```
>
A Listing of Post objects.
### getReports()​
#### Call Signature​
getReports(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Return a listing of things that have been reported.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"comment"
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getReports();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getReports({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getReports(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Return a listing of things that have been reported.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"post"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getReports();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getReports({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getReports(
```
options
```
):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things that have been reported.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"all"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getReports();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getReports({ type: "post"});console.log("Posts: ", await listing.all())
```
### getRisingPosts()​
getRisingPosts(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Get a list of hot posts from a specific subreddit.
#### Parameters​
##### options​
```
GetPostsOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
Post
```
>
A Listing of Post objects.
#### Example​
```
const posts = await reddit.getRisingPosts({ subredditName: 'memes', timeframe: 'day', limit: 1000, pageSize: 100}).all();
```
### getRules()​
getRules(
```
subredditName
```
):
```
Promise
```
<
```
Rule
```
[]>
Get the rules for a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to get the rules for.
#### Returns​
```
Promise
```
<
```
Rule
```
[]>
An array of Rule objects.
### getSnoovatarUrl()​
getSnoovatarUrl(
```
username
```
):
```
Promise
```
<
```
undefined
```
|
```
string
```
>
Get the snoovatar URL for a given username.
#### Parameters​
##### username​
```
string
```
The username of the snoovatar to retrieve
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
string
```
>
A Promise that resolves to a URL of the snoovatar image if it exists.
### getSpam()​
#### Call Signature​
getSpam(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Return a listing of things that have been marked as spam or otherwise removed.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"comment"
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getSpam();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getSpam({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getSpam(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Return a listing of things that have been marked as spam or otherwise removed.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"post"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getSpam();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getSpam({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getSpam(
```
options
```
):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things that have been marked as spam or otherwise removed.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"all"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getSpam();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getSpam({ type: "post"});console.log("Posts: ", await listing.all())
```
### getSubredditById()​
getSubredditById(
```
id
```
):
```
Promise
```
<
```
undefined
```
|
```
Subreddit
```
>
Gets a Subreddit object by ID
#### Parameters​
##### id​
```
string
```
The ID (starting with t5_) of the subreddit to retrieve. e.g. t5_2qjpg
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
Subreddit
```
>
A Promise that resolves a Subreddit object.
#### Deprecated​
Use getSubredditInfoById instead.
#### Example​
```
const memes = await reddit.getSubredditById('t5_2qjpg');
```
### getSubredditByName()​
getSubredditByName(
```
name
```
):
```
Promise
```
<
```
Subreddit
```
>
Gets a Subreddit object by name
#### Parameters​
##### name​
```
string
```
The name of a subreddit omitting the r/. This is case insensitive.
#### Returns​
```
Promise
```
<
```
Subreddit
```
>
A Promise that resolves a Subreddit object.
#### Deprecated​
Use getSubredditInfoByName instead.
#### Example​
```
const askReddit = await reddit.getSubredditByName('askReddit');
```
### getSubredditInfoById()​
getSubredditInfoById(
```
id
```
):
```
Promise
```
<
```
SubredditInfo
```
>
Gets a SubredditInfo object by ID
#### Parameters​
##### id​
```
string
```
The ID (starting with t5_) of the subreddit to retrieve. e.g. t5_2qjpg
#### Returns​
```
Promise
```
<
```
SubredditInfo
```
>
A Promise that resolves a SubredditInfo object.
#### Example​
```
const memes = await reddit.getSubredditInfoById('t5_2qjpg');
```
### getSubredditInfoByName()​
getSubredditInfoByName(
```
name
```
):
```
Promise
```
<
```
SubredditInfo
```
>
Gets a SubredditInfo object by name
#### Parameters​
##### name​
```
string
```
The name of a subreddit omitting the r/. This is case insensitive.
#### Returns​
```
Promise
```
<
```
SubredditInfo
```
>
A Promise that resolves a SubredditInfo object.
#### Example​
```
const askReddit = await reddit.getSubredditInfoByName('askReddit');
```
### getSubredditLeaderboard()​
getSubredditLeaderboard(
```
subredditId
```
):
```
Promise
```
<
```
SubredditLeaderboard
```
>
Returns a leaderboard for a given subreddit ID.
#### Parameters​
##### subredditId​
```
string
```
ID of the subreddit for which the leaderboard is being queried.
#### Returns​
```
Promise
```
<
```
SubredditLeaderboard
```
>
Leaderboard for the given subreddit.
### getSubredditRemovalReasons()​
getSubredditRemovalReasons(
```
subredditName
```
):
```
Promise
```
<
```
RemovalReason
```
[]>
Get the list of subreddit's removal reasons (ordered).
#### Parameters​
##### subredditName​
```
string
```
Name of the subreddit (e.g.
```
askReddit
```
or
```
r/askReddit
```
).
#### Returns​
```
Promise
```
<
```
RemovalReason
```
[]>
Ordered array of plain removal reason objects.
#### Example​
```
const reasons = await reddit.getSubredditRemovalReasons('askReddit');const sub = await reddit.getSubredditByName('askReddit');for (const reason of reasons) { console.log(reason.id, reason.message, reason.title); await sub.updateRemovalReason(reason.id, { title: 'Spam', message: 'Updated.' }); await sub.deleteRemovalReason(reason.id);}
```
### getSubredditStyles()​
getSubredditStyles(
```
subredditId
```
):
```
Promise
```
<
```
SubredditStyles
```
>
Returns the styles for a given subreddit ID.
#### Parameters​
##### subredditId​
```
string
```
ID of the subreddit from which to retrieve the styles.
#### Returns​
```
Promise
```
<
```
SubredditStyles
```
>
Styles for the given subreddit.
### getTopPosts()​
getTopPosts(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Get a list of controversial posts from a specific subreddit.
#### Parameters​
##### options​
```
GetPostsOptionsWithTimeframe
```
Options for the request
#### Returns​
```
Listing
```
<
```
Post
```
>
A Listing of Post objects.
#### Example​
```
const posts = await reddit.getControversialPosts({ subredditName: 'memes', timeframe: 'day', limit: 1000, pageSize: 100}).all();
```
### getUnmoderated()​
#### Call Signature​
getUnmoderated(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Return a listing of things that have yet to be approved/removed by a mod.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"comment"
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getUnmoderated();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getUnmoderated({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getUnmoderated(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Return a listing of things that have yet to be approved/removed by a mod.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"post"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getUnmoderated();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getUnmoderated({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getUnmoderated(
```
options
```
):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things that have yet to be approved/removed by a mod.
##### Parameters​
###### options​
```
ModLogOptions
```
<
```
"all"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getUnmoderated();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getUnmoderated({ type: "post"});console.log("Posts: ", await listing.all())
```
### getUserById()​
getUserById(
```
id
```
):
```
Promise
```
<
```
undefined
```
|
```
User
```
>
Gets a User object by ID
#### Parameters​
##### id​
```
string
```
The ID (starting with t2_) of the user to retrieve. e.g. t2_1qjpg
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
User
```
>
A Promise that resolves to a User object.
#### Example​
```
const user = await reddit.getUserById('t2_1qjpg');
```
### getUserByUsername()​
getUserByUsername(
```
username
```
):
```
Promise
```
<
```
undefined
```
|
```
User
```
>
Gets a User object by username
#### Parameters​
##### username​
```
string
```
The username of the user omitting the u/. e.g. 'devvit'
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
User
```
>
A Promise that resolves to a User object or undefined if user is
not found (user doesn't exist, account suspended, etc).
#### Example​
```
const user = await reddit.getUserByUsername('devvit');if (user) { console.log(user)}
```
### getUserFlairTemplates()​
getUserFlairTemplates(
```
subredditName
```
):
```
Promise
```
<
```
FlairTemplate
```
[]>
Get the list of user flair templates for a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to get the user flair templates for.
#### Returns​
```
Promise
```
<
```
FlairTemplate
```
[]>
A Promise that resolves with an array of FlairTemplate objects.
### getUserKarmaFromCurrentSubreddit()​
getUserKarmaFromCurrentSubreddit(
```
username
```
):
```
Promise
```
<
```
GetUserKarmaForSubredditResponse
```
>
Returns the karma for a given user in the current subreddit.
The user making the request must be a moderator of the subreddit to read another user's karma in the subreddit.
An exception is if the specified user is the same as the user making the request.
#### Parameters​
##### username​
```
string
```
The username of the user to get the karma for. e.g. 'spez'
#### Returns​
```
Promise
```
<
```
GetUserKarmaForSubredditResponse
```
>
The GetUserKarmaForSubredditResponse, containing the user's karma for posts and comments in the subreddit.
### getVaultByAddress()​
getVaultByAddress(
```
address
```
):
```
Promise
```
<
```
Vault
```
>
Gets a Vault for the specified address.
#### Parameters​
##### address​
```
string
```
The address (starting with 0x) of the Vault.
#### Returns​
```
Promise
```
<
```
Vault
```
>
#### Example​
```
const vault = await reddit.getVaultByAddress('0x205ee28744456bDBf180A0Fa7De51e0F116d54Ed');
```
### getVaultByUserId()​
getVaultByUserId(
```
userId
```
):
```
Promise
```
<
```
Vault
```
>
Gets a Vault for the specified user.
#### Parameters​
##### userId​
```
string
```
The ID (starting with t2_) of the Vault owner.
#### Returns​
```
Promise
```
<
```
Vault
```
>
#### Example​
```
const vault = await reddit.getVaultByUserId('t2_1w72');
```
### getWidgets()​
getWidgets(
```
subredditName
```
):
```
Promise
```
<
```
Widget
```
[]>
Get the widgets for a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to get the widgets for.
#### Returns​
```
Promise
```
<
```
Widget
```
[]>
An array of Widget objects.
### getWikiContributors()​
getWikiContributors(
```
options
```
):
```
Listing
```
<
```
User
```
>
Get a list of users who are wiki contributors of a subreddit.
#### Parameters​
##### options​
```
GetSubredditUsersOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
User
```
>
A Listing of User objects.
### getWikiPage()​
getWikiPage(
```
subredditName
```
,
```
page
```
,
```
revisionId
```
?):
```
Promise
```
<
```
WikiPage
```
>
Get a wiki page from a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to get the wiki page from.
##### page​
```
string
```
The name of the wiki page to get.
##### revisionId?​
```
`${string}-${string}-${string}-${string}-${string}`
```
The revision ID of the wiki page version to get. Setting this value will return the wiki page
version at that revision, and leaving it empty will return the latest version.
#### Returns​
```
Promise
```
<
```
WikiPage
```
>
The requested WikiPage object.
### getWikiPageRevisions()​
getWikiPageRevisions(
```
options
```
):
```
Listing
```
<
```
WikiPageRevision
```
>
Get the revisions for a wiki page.
#### Parameters​
##### options​
```
GetPageRevisionsOptions
```
Options for the request
#### Returns​
```
Listing
```
<
```
WikiPageRevision
```
>
A Listing of WikiPageRevision objects.
### getWikiPages()​
getWikiPages(
```
subredditName
```
):
```
Promise
```
<
```
string
```
[]>
Get the wiki pages for a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to get the wiki pages from.
#### Returns​
```
Promise
```
<
```
string
```
[]>
A list of the wiki page names for the subreddit.
### getWikiPageSettings()​
getWikiPageSettings(
```
subredditName
```
,
```
page
```
):
```
Promise
```
<
```
WikiPageSettings
```
>
Get the settings for a wiki page.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit the wiki is in.
##### page​
```
string
```
The name of the wiki page to get the settings for.
#### Returns​
```
Promise
```
<
```
WikiPageSettings
```
>
A WikiPageSettings object.
### inviteModerator()​
inviteModerator(
```
options
```
):
```
Promise
```
<
```
void
```
>
Invite a user to become a moderator of a subreddit.
#### Parameters​
##### options​
```
InviteModeratorOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
void
```
>
### markAllMessagesAsRead()​
markAllMessagesAsRead():
```
Promise
```
<
```
void
```
>
Mark all private messages as read.
#### Returns​
```
Promise
```
<
```
void
```
>
### muteUser()​
muteUser(
```
options
```
):
```
Promise
```
<
```
void
```
>
Mute a user in a subreddit. Muting a user prevents them from sending modmail.
#### Parameters​
##### options​
```
MuteUserOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
void
```
>
### remove()​
remove(
```
id
```
,
```
isSpam
```
):
```
Promise
```
<
```
void
```
>
Remove a post or comment.
#### Parameters​
##### id​
```
string
```
The id of the post (t3_) or comment (t1_) to remove.
##### isSpam​
```
boolean
```
Is the post or comment being removed because it's spam?
#### Returns​
```
Promise
```
<
```
void
```
>
#### Example​
```
await reddit.remove('t3_123456', false);await reddit.remove('t1_123456', true);
```
### removeEditorFromWikiPage()​
removeEditorFromWikiPage(
```
subredditName
```
,
```
page
```
,
```
username
```
):
```
Promise
```
<
```
void
```
>
Remove an editor from a wiki page.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit the wiki is in.
##### page​
```
string
```
The name of the wiki page to remove the editor from.
##### username​
```
string
```
The username of the user to remove as an editor.
#### Returns​
```
Promise
```
<
```
void
```
>
### removeModerator()​
removeModerator(
```
username
```
,
```
subredditName
```
):
```
Promise
```
<
```
void
```
>
Remove a user as a moderator of a subreddit.
#### Parameters​
##### username​
```
string
```
The username of the user to remove as a moderator. e.g. 'spez'
##### subredditName​
```
string
```
The name of the subreddit to remove the user as a moderator from. e.g. 'memes'
#### Returns​
```
Promise
```
<
```
void
```
>
### removePostFlair()​
removePostFlair(
```
subredditName
```
,
```
postId
```
):
```
Promise
```
<
```
void
```
>
Remove the flair for a post in a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to remove the flair from.
##### postId​
```
string
```
The ID of the post to remove the flair from.
#### Returns​
```
Promise
```
<
```
void
```
>
### removeUser()​
removeUser(
```
username
```
,
```
subredditName
```
):
```
Promise
```
<
```
void
```
>
Remove a user's approval to post in a subreddit.
#### Parameters​
##### username​
```
string
```
The username of the user to remove approval from. e.g. 'spez'
##### subredditName​
```
string
```
The name of the subreddit to remove the user's approval from. e.g. 'memes'
#### Returns​
```
Promise
```
<
```
void
```
>
### removeUserFlair()​
removeUserFlair(
```
subredditName
```
,
```
username
```
):
```
Promise
```
<
```
void
```
>
Remove the flair for a user in a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to remove the flair from.
##### username​
```
string
```
The username of the user to remove the flair from.
#### Returns​
```
Promise
```
<
```
void
```
>
### removeWikiContributor()​
removeWikiContributor(
```
username
```
,
```
subredditName
```
):
```
Promise
```
<
```
void
```
>
Remove a user's wiki contributor status for a subreddit.
#### Parameters​
##### username​
```
string
```
The username of the user to remove wiki contributor status from. e.g. 'spez'
##### subredditName​
```
string
```
The name of the subreddit to remove the user's wiki contributor status from. e.g. 'memes'
#### Returns​
```
Promise
```
<
```
void
```
>
### reorderRules()​
reorderRules(
```
subredditName
```
,
```
rules
```
):
```
Promise
```
<
```
void
```
>
Reorder the rules in a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to reorder the rules for.
##### rules​
```
Rule
```
[]
Array of Rule objects in the desired order (order is determined by array position).
#### Returns​
```
Promise
```
<
```
void
```
>
### reorderWidgets()​
reorderWidgets(
```
subredditName
```
,
```
orderByIds
```
):
```
Promise
```
<
```
void
```
>
Reorder the widgets for a subreddit.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to reorder the widgets for.
##### orderByIds​
```
string
```
[]
An array of widget IDs in the order that they should be displayed.
#### Returns​
```
Promise
```
<
```
void
```
>
### report()​
report(
```
thing
```
,
```
options
```
):
```
Promise
```
<
```
JsonStatus
```
>
Report a Post or Comment
The report is sent to the moderators of the subreddit for review.
#### Parameters​
##### thing​
Post or Comment
```
Post
```
|
```
Comment
```
##### options​
Options
###### reason​
```
string
```
Why the thing is reported
#### Returns​
```
Promise
```
<
```
JsonStatus
```
>
#### Example​
```
await reddit.report(post, { reason: 'This is spam!',})
```
### revertWikiPage()​
revertWikiPage(
```
subredditName
```
,
```
page
```
,
```
revisionId
```
):
```
Promise
```
<
```
void
```
>
Revert a wiki page to a previous revision.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit the wiki is in.
##### page​
```
string
```
The name of the wiki page to revert.
##### revisionId​
```
string
```
The ID of the revision to revert to.
#### Returns​
```
Promise
```
<
```
void
```
>
### revokeModeratorInvite()​
revokeModeratorInvite(
```
username
```
,
```
subredditName
```
):
```
Promise
```
<
```
void
```
>
Revoke a moderator invite for a user to a subreddit.
#### Parameters​
##### username​
```
string
```
The username of the user to revoke the invite for. e.g. 'spez'
##### subredditName​
```
string
```
The name of the subreddit to revoke the invite for. e.g. 'memes'
#### Returns​
```
Promise
```
<
```
void
```
>
### sendPrivateMessage()​
sendPrivateMessage(
```
options
```
):
```
Promise
```
<
```
void
```
>
Sends a private message to a user.
#### Parameters​
##### options​
```
SendPrivateMessageOptions
```
The options for sending the message.
#### Returns​
```
Promise
```
<
```
void
```
>
A Promise that resolves if the private message was successfully sent.
### sendPrivateMessageAsSubreddit()​
sendPrivateMessageAsSubreddit(
```
options
```
):
```
Promise
```
<
```
void
```
>
Sends a private message to a user on behalf of a subreddit.
#### Parameters​
##### options​
```
SendPrivateMessageAsSubredditOptions
```
The options for sending the message as a subreddit.
#### Returns​
```
Promise
```
<
```
void
```
>
A Promise that resolves if the private message was successfully sent.
#### Deprecated​
No longer working as expected. Use modMail.createConversation with
```
isAuthorHidden: true
```
instead
### setModeratorPermissions()​
setModeratorPermissions(
```
username
```
,
```
subredditName
```
,
```
permissions
```
):
```
Promise
```
<
```
void
```
>
Update the permissions of a moderator of a subreddit.
#### Parameters​
##### username​
```
string
```
The username of the user to update the permissions for. e.g. 'spez'
##### subredditName​
```
string
```
The name of the subreddit. e.g. 'memes'
##### permissions​
```
ModeratorPermission
```
[]
The permissions to give the user. e.g ['posts', 'wiki']
#### Returns​
```
Promise
```
<
```
void
```
>
### setPostFlair()​
setPostFlair(
```
options
```
):
```
Promise
```
<
```
void
```
>
Set the flair for a post in a subreddit.
#### Parameters​
##### options​
```
SetPostFlairOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
void
```
>
### setUserFlair()​
setUserFlair(
```
options
```
):
```
Promise
```
<
```
void
```
>
Set the flair for a user in a subreddit.
#### Parameters​
##### options​
```
SetUserFlairOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
void
```
>
### setUserFlairBatch()​
setUserFlairBatch(
```
subredditName
```
,
```
flairs
```
):
```
Promise
```
<
```
FlairCsvResult
```
[]>
Set the flair of multiple users in the same subreddit with a single API call.
Can process up to 100 entries at once.
#### Parameters​
##### subredditName​
```
string
```
The name of the subreddit to edit flairs in.
##### flairs​
```
SetUserFlairBatchConfig
```
[]
Array of user flair configuration objects. If both text and cssClass are empty for a given user the flair will be cleared.
#### Returns​
```
Promise
```
<
```
FlairCsvResult
```
[]>
Array of statuses for each entry provided.
### submitComment()​
submitComment(
```
options
```
):
```
Promise
```
<
```
Comment
```
>
Submit a new comment to a post or comment.
#### Parameters​
##### options​
```
CommentSubmissionOptions
```
&
```
object
```
You must provide either
```
options.text
```
or
```
options.richtext
```
but not both.
#### Returns​
```
Promise
```
<
```
Comment
```
>
A Promise that resolves to a Comment object.
#### Example​
```
import { RunAs } from '@devvit/public-api';const comment = await reddit.submitComment({ id: 't1_1qgif', text: 'Hello world!', runAs: RunAs.APP,})
```
### submitPost()​
submitPost(
```
options
```
):
```
Promise
```
<
```
Post
```
>
Submits a new post to a subreddit.
#### Parameters​
##### options​
```
SubmitPostOptions
```
Either a self post or a link post.
#### Returns​
```
Promise
```
<
```
Post
```
>
A Promise that resolves to a Post object.
#### Examples​
```
const post = await reddit.submitPost({ subredditName: 'devvit', title: 'Hello World', richtext: new RichTextBuilder() .heading({ level: 1 }, (h) => { h.rawText('Hello world'); }) .codeBlock({}, (cb) => cb.rawText('This post was created via the Devvit API')) .build()});
```
By default,
```
submitPost()
```
creates a Post on behalf of the App account, but it may be called on behalf of the User making the request by setting the option
```
runAs: RunAs.USER
```
.
When using
```
runAs: RunAs.USER
```
to create an experience Post, you must specify the
```
userGeneratedContent
```
option. For example:
```
import { RunAs } from '@devvit/public-api';const post = await reddit.submitPost({ title: 'My Devvit Post', runAs: RunAs.USER, userGeneratedContent: { text: "hello there", imageUrls: ["https://styles.redditmedia.com/t5_5wa5ww/styles/communityIcon_wyopomb2xb0a1.png", "https://styles.redditmedia.com/t5_49fkib/styles/bannerBackgroundImage_5a4axis7cku61.png"] }, subredditName: await reddit.getCurrentSubredditName(), textFallback: { text: 'This is a Devvit post!', }, preview: ( <vstack height="100%" width="100%" alignment="middle center"> <text size="large">Loading...</text> </vstack> ),});
```
### subscribeToCurrentSubreddit()​
subscribeToCurrentSubreddit():
```
Promise
```
<
```
void
```
>
Subscribes to the subreddit in which the app is installed. No-op if the user is already subscribed.
This method will execute as the app account by default.
To subscribe on behalf of a user, please contact Reddit.
#### Returns​
```
Promise
```
<
```
void
```
>
### unbanUser()​
unbanUser(
```
username
```
,
```
subredditName
```
):
```
Promise
```
<
```
void
```
>
Unban a user from a subreddit.
#### Parameters​
##### username​
```
string
```
The username of the user to unban. e.g. 'spez'
##### subredditName​
```
string
```
The name of the subreddit to unban the user from. e.g. 'memes'
#### Returns​
```
Promise
```
<
```
void
```
>
### unbanWikiContributor()​
unbanWikiContributor(
```
username
```
,
```
subredditName
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
The username of the user to unban. e.g. 'spez'
##### subredditName​
```
string
```
The name of the subreddit to unban the user from contributing to the wiki on. e.g. 'memes'
#### Returns​
```
Promise
```
<
```
void
```
>
### unmuteUser()​
unmuteUser(
```
username
```
,
```
subredditName
```
):
```
Promise
```
<
```
void
```
>
Unmute a user in a subreddit. Unmuting a user allows them to send modmail.
#### Parameters​
##### username​
```
string
```
The username of the user to unmute. e.g. 'spez'
##### subredditName​
```
string
```
The name of the subreddit to unmute the user in. e.g. 'memes'
#### Returns​
```
Promise
```
<
```
void
```
>
### unsubscribeFromCurrentSubreddit()​
unsubscribeFromCurrentSubreddit():
```
Promise
```
<
```
void
```
>
Unsubscribes from the subreddit in which the app is installed. No-op if the user isn't subscribed.
This method will execute as the app account by default.
To unsubscribe on behalf of a user, please contact Reddit.
#### Returns​
```
Promise
```
<
```
void
```
>
### updateSubredditRemovalReason()​
updateSubredditRemovalReason(
```
subredditName
```
,
```
reasonId
```
,
```
options
```
):
```
Promise
```
<
```
void
```
>
Update an existing removal reason in a subreddit.
#### Parameters​
##### subredditName​
```
string
```
Name of the subreddit (e.g.
```
askReddit
```
or
```
r/askReddit
```
).
##### reasonId​
```
string
```
ID of the removal reason (from get or add).
##### options​
###### message​
```
string
```
The message associated with the removal reason.
###### title​
```
string
```
The title of the removal reason.
#### Returns​
```
Promise
```
<
```
void
```
>
### updateWidget()​
updateWidget(
```
widgetData
```
):
```
Promise
```
<
```
Widget
```
>
Update a widget for a subreddit.
#### Parameters​
##### widgetData​
```
UpdateWidgetData
```
The data for the widget to update.
#### Returns​
```
Promise
```
<
```
Widget
```
>
The updated Widget object.
### updateWikiPage()​
updateWikiPage(
```
options
```
):
```
Promise
```
<
```
WikiPage
```
>
Update a wiki page.
#### Parameters​
##### options​
```
UpdateWikiPageOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
WikiPage
```
>
The updated WikiPage object.
### updateWikiPageSettings()​
updateWikiPageSettings(
```
options
```
):
```
Promise
```
<
```
WikiPageSettings
```
>
Update the settings for a wiki page.
#### Parameters​
##### options​
```
UpdatePageSettingsOptions
```
Options for the request
#### Returns​
```
Promise
```
<
```
WikiPageSettings
```
>
A WikiPageSettings object.
Previous
Reddit API Overview
Next
AuthorFlairSettings
Example
Constructors
new RedditAPIClient()
Accessors
modMail
Methods
addEditorToWikiPage()
addModNote()
addRemovalNote()
addSubredditRemovalReason()
addWidget()
addWikiContributor()
approve()
approveUser()
banUser()
banWikiContributor()
createPostFlairTemplate()
createRule()
createUserFlairTemplate()
createWikiPage()
crosspost()
deleteFlairTemplate()
deleteModNote()
deleteSubredditRemovalReason()
deleteWidget()
editFlairTemplate()
getApprovedUsers()
getAppUser()
getBannedUsers()
getBannedWikiContributors()
getBestPosts()
getCommentById()
getComments()
getCommentsAndPostsByUser()
getCommentsByUser()
getControversialPosts()
getCurrentSubreddit()
getCurrentSubredditName()
getCurrentUser()
getCurrentUsername()
getDuplicatesForPost()
getEdited()
getHotPosts()
getMessages()
getModerationLog()
getModerators()
getModNotes()
getModQueue()
getMutedUsers()
getNewPosts()
getPostById()
getPostFlairTemplates()
getPostsByUser()
getReports()
getRisingPosts()
getRules()
getSnoovatarUrl()
getSpam()
getSubredditById()
getSubredditByName()
getSubredditInfoById()
getSubredditInfoByName()
getSubredditLeaderboard()
getSubredditRemovalReasons()
getSubredditStyles()
getTopPosts()
getUnmoderated()
getUserById()
getUserByUsername()
getUserFlairTemplates()
getUserKarmaFromCurrentSubreddit()
getVaultByAddress()
getVaultByUserId()
getWidgets()
getWikiContributors()
getWikiPage()
getWikiPageRevisions()
getWikiPages()
getWikiPageSettings()
inviteModerator()
markAllMessagesAsRead()
muteUser()
remove()
removeEditorFromWikiPage()
removeModerator()
removePostFlair()
removeUser()
removeUserFlair()
removeWikiContributor()
reorderRules()
reorderWidgets()
report()
revertWikiPage()
revokeModeratorInvite()
sendPrivateMessage()
sendPrivateMessageAsSubreddit()
setModeratorPermissions()
setPostFlair()
setUserFlair()
setUserFlairBatch()
submitComment()
submitPost()
subscribeToCurrentSubreddit()
unbanUser()
unbanWikiContributor()
unmuteUser()
unsubscribeFromCurrentSubreddit()
updateSubredditRemovalReason()
updateWidget()
updateWikiPage()
updateWikiPageSettings()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.1 AuthorFlairSettings

AuthorFlairSettings | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
AuthorFlairSettings
On this page
# AuthorFlairSettings
@devvit/public-api v0.12.20-dev
# Class: AuthorFlairSettings
## Constructors​
### new AuthorFlairSettings()​
new AuthorFlairSettings():
```
AuthorFlairSettings
```
#### Returns​
```
AuthorFlairSettings
```
## Properties​
### isEnabled?​
```
optional
```
isEnabled:
```
boolean
```
### isSelfAssignabled?​
```
optional
```
isSelfAssignabled:
```
boolean
```
Previous
Reddit API Client
Next
ButtonWidget
Constructors
new AuthorFlairSettings()
Properties
isEnabled?
isSelfAssignabled?
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.10 ModMailService

ModMailService | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
ModMailService
On this page
# ModMailService
@devvit/public-api v0.12.20-dev
# Class: ModMailService
Class providing the methods for working with Mod Mail
## Properties​
### notificationSubjectPrefix​
```
readonly
```
notificationSubjectPrefix:
```
"[notification]"
```
=
```
'[notification]'
```
## Methods​
### approveConversation()​
approveConversation(
```
conversationId
```
):
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
Approve the non mod user associated with a particular conversation.
#### Parameters​
##### conversationId​
```
string
```
Id of a modmail conversation
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
#### Example​
```
await reddit.modMail.approveConversation('abcdef');
```
### archiveConversation()​
archiveConversation(
```
conversationId
```
):
```
Promise
```
<
```
ConversationResponse
```
>
Marks a conversation as archived
#### Parameters​
##### conversationId​
```
string
```
Id of a modmail conversation
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
>
#### Example​
```
await reddit.modMail.archive('abcdef');
```
### bulkReadConversations()​
bulkReadConversations(
```
subreddits
```
,
```
state
```
):
```
Promise
```
<
```
string
```
[]>
Marks all conversations read for a particular conversation state within the passed list of subreddits.
#### Parameters​
##### subreddits​
```
string
```
[]
Array of subreddit names
##### state​
```
ConversationStateFilter
```
One of the possible conversation states ('all' to read all conversations)
#### Returns​
```
Promise
```
<
```
string
```
[]>
conversationIds
#### Example​
```
const conversationIds = await reddit.modMail.bulkReadConversations( ['askReddit', 'myAwesomeSubreddit'], 'filtered');
```
### createConversation()​
createConversation(
```
params
```
):
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
Creates a new conversation for a particular SR.
This endpoint will create a ModmailConversation object
as well as the first ModmailMessage within the ModmailConversation object.
#### Parameters​
##### params​
###### body​
```
string
```
markdown text
###### isAuthorHidden?​
```
boolean
```
is author hidden? (default: false)
###### subject​
```
string
```
subject of the conversation. max 100 characters
###### subredditName​
```
string
```
subreddit name
###### to?​
```
null
```
|
```
string
```
a user (e.g. u/username), a subreddit (e.g. r/subreddit) or null
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
#### Note​
Note on {param.to}:
The to field for this endpoint is somewhat confusing. It can be:
A User, passed like "username" or "u/username"
A Subreddit, passed like "r/subreddit"
null, meaning an internal moderator discussion
In this way to is a bit of a misnomer in modmail conversations.
What it really means is the participant of the conversation who is not a mod of the subreddit.
If you plan to send a message to the app-account or a moderator of the subreddit, use ModMailService.createModDiscussionConversation, ModMailService.createModInboxConversation, or ModMailService.createModNotification instead.
Otherwise, messages sent to the app-account or moderator will automatically be routed to Mod Discussions.
#### Example​
```
const { conversation, messages, modActions } = await reddit.modMail.createConversation({ subredditName: 'askReddit', subject: 'Test conversation', body: 'Lorem ipsum sit amet', to: null,});
```
### createModDiscussionConversation()​
createModDiscussionConversation(
```
params
```
):
```
Promise
```
<
```
string
```
>
Creates a conversation in Mod Discussions with the moderators of the given subredditId.
Note: The app must be installed in the subreddit in order to create a conversation in Mod Discussions.
#### Parameters​
##### params​
###### bodyMarkdown​
```
string
```
###### subject​
```
string
```
###### subredditId​
```
string
```
#### Returns​
```
Promise
```
<
```
string
```
>
A Promise that resolves a string representing the conversationId of the message.
#### Example​
```
const conversationId = await reddit.modMail.createModDiscussionConversation({ subject: 'Test conversation', bodyMarkdown: '**Hello there** \n\n _Have a great day!_', subredditId: context.subredditId});
```
### createModInboxConversation()​
createModInboxConversation(
```
params
```
):
```
Promise
```
<
```
string
```
>
Creates a conversation in the Modmail Inbox with the moderators of the given subredditId.
#### Parameters​
##### params​
###### bodyMarkdown​
```
string
```
###### subject​
```
string
```
###### subredditId​
```
string
```
#### Returns​
```
Promise
```
<
```
string
```
>
A Promise that resolves a string representing the conversationId of the message.
#### Example​
```
const conversationId = await reddit.modMail.createModInboxConversation({ subject: 'Test conversation', bodyMarkdown: '**Hello there** \n\n _Have a great day!_', subredditId: context.subredditId});
```
### createModNotification()​
createModNotification(
```
params
```
):
```
Promise
```
<
```
string
```
>
Creates a notification in the Modmail Inbox.
This function is different from ModMailService.createModInboxConversation in that the conversation also appears in the "Notifications" section of Modmail.
#### Parameters​
##### params​
###### bodyMarkdown​
```
string
```
###### subject​
```
string
```
###### subredditId​
```
string
```
#### Returns​
```
Promise
```
<
```
string
```
>
A Promise that resolves a string representing the conversationId of the message.
#### Example​
```
const conversationId = await reddit.modMail.createModNotification({ subject: 'Test notification', bodyMarkdown: '**Hello there** \n\n _This is a notification!_', subredditId: context.subredditId});
```
### disapproveConversation()​
disapproveConversation(
```
conversationId
```
):
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
Disapprove the non mod user associated with a particular conversation.
#### Parameters​
##### conversationId​
```
string
```
Id of a modmail conversation
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
#### Example​
```
await reddit.modMail.disapproveConversation('abcdef');
```
### getConversation()​
getConversation(
```
params
```
):
```
Promise
```
<
```
GetConversationResponse
```
>
Returns all messages, mod actions and conversation metadata for a given conversation id
#### Parameters​
##### params​
###### conversationId​
```
string
```
a modmail conversation id
###### markRead?​
```
boolean
```
mark read?
#### Returns​
```
Promise
```
<
```
GetConversationResponse
```
>
#### Example​
```
const { conversation, messages, modActions, user } = await reddit.modMail.getConversation({ conversationId: 'abcdef', markRead: true });
```
### getConversations()​
getConversations(
```
params
```
):
```
Promise
```
<
```
GetConversationsResponse
```
>
Get conversations for a logged in user or subreddits
#### Parameters​
##### params​
```
GetConversationsRequest
```
#### Returns​
```
Promise
```
<
```
GetConversationsResponse
```
>
#### Example​
```
const {viewerId, conversations} = await reddit.modMail.getConversations({ after: 'abcdef', limit: 42});const arrayOfConversations = Object.values(conversations);
```
### getSubreddits()​
getSubreddits():
```
Promise
```
<{}>
Returns a list of Subreddits that the user moderates with mail permission
#### Returns​
```
Promise
```
<{}>
#### Example​
```
const subredditsData = await reddit.modMail.getSubreddits();for (const subreddit of Object.values(subreddits)) { console.log(subreddit.id); console.log(subreddit.name);}
```
### getUnreadCount()​
getUnreadCount():
```
Promise
```
<
```
UnreadCountResponse
```
>
Endpoint to retrieve the unread conversation count by conversation state.
#### Returns​
```
Promise
```
<
```
UnreadCountResponse
```
>
#### Example​
```
const response = await reddit.modMail.getUnreadCount();console.log(response.highlighted);console.log(response.new);
```
### getUserConversations()​
getUserConversations(
```
conversationId
```
):
```
Promise
```
<
```
ConversationUserData
```
>
Returns recent posts, comments and modmail conversations for a given user.
#### Parameters​
##### conversationId​
```
string
```
Id of a modmail conversation
#### Returns​
```
Promise
```
<
```
ConversationUserData
```
>
#### Example​
```
const data = await reddit.modMail.getUserConversations('abcdef');console.log(data.recentComments);console.log(data.recentPosts);
```
### highlightConversation()​
highlightConversation(
```
conversationId
```
):
```
Promise
```
<
```
ConversationResponse
```
>
Marks a conversation as highlighted.
#### Parameters​
##### conversationId​
```
string
```
Id of a modmail conversation
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
>
#### Example​
```
await reddit.modMail.highlightConversation('abcdef');
```
### muteConversation()​
muteConversation(
```
params
```
):
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
Marks a conversation as read for the user.
#### Parameters​
##### params​
###### conversationId​
```
string
```
Id of a modmail conversation
###### numHours​
```
72
```
|
```
168
```
|
```
672
```
For how many hours the conversation needs to be muted. Must be one of 72, 168, or 672 hours
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
#### Example​
```
await reddit.modMail.muteConversation({ conversationId: 'abcdef', numHours: 72 });
```
### readConversations()​
readConversations(
```
conversationIds
```
):
```
Promise
```
<
```
void
```
>
Marks a conversations as read for the user.
#### Parameters​
##### conversationIds​
```
string
```
[]
An array of ids
#### Returns​
```
Promise
```
<
```
void
```
>
#### Example​
```
await reddit.modMail.readConversations(['abcdef', 'qwerty']);
```
### reply()​
reply(
```
params
```
):
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
Creates a new message for a particular conversation.
#### Parameters​
##### params​
###### body​
```
string
```
markdown text
###### conversationId​
```
string
```
Id of a modmail conversation
###### isAuthorHidden?​
```
boolean
```
is author hidden? (default: false)
###### isInternal?​
```
boolean
```
is internal message? (default: false)
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
#### Example​
```
await reddit.modMail.reply({ body: 'Lorem ipsum sit amet', conversationId: 'abcdef',});
```
### tempBanConversation()​
tempBanConversation(
```
params
```
):
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
Temporary ban (switch from permanent to temporary ban) the non mod user associated with a particular conversation.
#### Parameters​
##### params​
###### conversationId​
```
string
```
a modmail conversation id
###### duration​
```
number
```
duration in days, max 999
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
#### Example​
```
await reddit.modMail.tempBanConversation({ conversationId: 'abcdef', duration: 42 });
```
### unarchiveConversation()​
unarchiveConversation(
```
conversationId
```
):
```
Promise
```
<
```
ConversationResponse
```
>
Marks conversation as unarchived.
#### Parameters​
##### conversationId​
```
string
```
Id of a modmail conversation
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
>
#### Example​
```
await reddit.modMail.unarchiveConversation('abcdef');
```
### unbanConversation()​
unbanConversation(
```
conversationId
```
):
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
Unban the non mod user associated with a particular conversation.
#### Parameters​
##### conversationId​
```
string
```
a modmail conversation id
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
#### Example​
```
await reddit.modMail.unbanConversation('abcdef');
```
### unhighlightConversation()​
unhighlightConversation(
```
conversationId
```
):
```
Promise
```
<
```
ConversationResponse
```
>
Removes a highlight from a conversation.
#### Parameters​
##### conversationId​
```
string
```
Id of a modmail conversation
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
>
#### Example​
```
await reddit.modMail.unhighlightConversation('abcdef');
```
### unmuteConversation()​
unmuteConversation(
```
conversationId
```
):
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
Unmutes the non mod user associated with a particular conversation.
#### Parameters​
##### conversationId​
```
string
```
Id of a modmail conversation
#### Returns​
```
Promise
```
<
```
ConversationResponse
```
&
```
WithUserData
```
>
#### Example​
```
await reddit.modMail.unmuteConversation('abcdef');
```
### unreadConversations()​
unreadConversations(
```
conversationIds
```
):
```
Promise
```
<
```
void
```
>
Marks conversations as unread for the user.
#### Parameters​
##### conversationIds​
```
string
```
[]
An array of ids
#### Returns​
```
Promise
```
<
```
void
```
>
#### Example​
```
await reddit.modMail.unreadConversations(['abcdef', 'qwerty']);
```
Previous
Listing
Next
ModNote
Properties
notificationSubjectPrefix
Methods
approveConversation()
archiveConversation()
bulkReadConversations()
createConversation()
createModDiscussionConversation()
createModInboxConversation()
createModNotification()
disapproveConversation()
getConversation()
getConversations()
getSubreddits()
getUnreadCount()
getUserConversations()
highlightConversation()
muteConversation()
readConversations()
reply()
tempBanConversation()
unarchiveConversation()
unbanConversation()
unhighlightConversation()
unmuteConversation()
unreadConversations()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.11 ModNote

ModNote | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
ModNote
On this page
# ModNote
@devvit/public-api v0.12.20-dev
# Class: ModNote
## Properties​
### createdAt​
createdAt:
```
Date
```
### id​
id:
```
string
```
### modAction?​
```
optional
```
modAction:
```
ModAction
```
### operator​
operator:
```
object
```
#### id?​
```
optional
```
id:
```
`t2_${string}`
```
#### name?​
```
optional
```
name:
```
string
```
### subreddit​
subreddit:
```
object
```
#### id?​
```
optional
```
id:
```
`t5_${string}`
```
#### name?​
```
optional
```
name:
```
string
```
### type​
type:
```
ModNoteType
```
### user​
user:
```
object
```
#### id?​
```
optional
```
id:
```
`t2_${string}`
```
#### name?​
```
optional
```
name:
```
string
```
### userNote?​
```
optional
```
userNote:
```
UserNote
```
Previous
ModMailService
Next
Post
Properties
createdAt
id
modAction?
operator
subreddit
type
user
userNote?
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.12 Post

Post | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
Post
On this page
# Post
@devvit/public-api v0.12.20-dev
# Class: Post
## Accessors​
### approved​
#### Get Signature​
get approved():
```
boolean
```
##### Returns​
```
boolean
```
### approvedAtUtc​
#### Get Signature​
get approvedAtUtc():
```
number
```
##### Returns​
```
number
```
### archived​
#### Get Signature​
get archived():
```
boolean
```
##### Returns​
```
boolean
```
### authorFlair​
#### Get Signature​
get authorFlair():
```
undefined
```
|
```
CommonFlair
```
##### Returns​
```
undefined
```
|
```
CommonFlair
```
### authorId​
#### Get Signature​
get authorId():
```
undefined
```
|
```
`t2_${string}`
```
##### Returns​
```
undefined
```
|
```
`t2_${string}`
```
### authorName​
#### Get Signature​
get authorName():
```
string
```
##### Returns​
```
string
```
### bannedAtUtc​
#### Get Signature​
get bannedAtUtc():
```
number
```
##### Returns​
```
number
```
### body​
#### Get Signature​
get body():
```
undefined
```
|
```
string
```
##### Returns​
```
undefined
```
|
```
string
```
### bodyHtml​
#### Get Signature​
get bodyHtml():
```
undefined
```
|
```
string
```
##### Returns​
```
undefined
```
|
```
string
```
### comments​
#### Get Signature​
get comments():
```
Listing
```
<
```
Comment
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
### createdAt​
#### Get Signature​
get createdAt():
```
Date
```
##### Returns​
```
Date
```
### distinguishedBy​
#### Get Signature​
get distinguishedBy():
```
undefined
```
|
```
string
```
##### Returns​
```
undefined
```
|
```
string
```
### edited​
#### Get Signature​
get edited():
```
boolean
```
##### Returns​
```
boolean
```
### flair​
#### Get Signature​
get flair():
```
undefined
```
|
```
CommonFlair
```
##### Returns​
```
undefined
```
|
```
CommonFlair
```
### gallery​
#### Get Signature​
get gallery():
```
GalleryMedia
```
[]
Get the media in the post. Empty if the post doesn't have any media.
##### Returns​
```
GalleryMedia
```
[]
### hidden​
#### Get Signature​
get hidden():
```
boolean
```
##### Returns​
```
boolean
```
### id​
#### Get Signature​
get id():
```
`t3_${string}`
```
##### Returns​
```
`t3_${string}`
```
### ignoringReports​
#### Get Signature​
get ignoringReports():
```
boolean
```
##### Returns​
```
boolean
```
### locked​
#### Get Signature​
get locked():
```
boolean
```
##### Returns​
```
boolean
```
### modReportReasons​
#### Get Signature​
get modReportReasons():
```
string
```
[]
##### Returns​
```
string
```
[]
### nsfw​
#### Get Signature​
get nsfw():
```
boolean
```
##### Returns​
```
boolean
```
### numberOfComments​
#### Get Signature​
get numberOfComments():
```
number
```
##### Returns​
```
number
```
### numberOfReports​
#### Get Signature​
get numberOfReports():
```
number
```
##### Returns​
```
number
```
### permalink​
#### Get Signature​
get permalink():
```
string
```
##### Returns​
```
string
```
### pollData​
#### Get Signature​
get pollData():
```
undefined
```
|
```
PollData
```
Poll data for the post, if the post is a poll. Undefined otherwise.
##### Returns​
```
undefined
```
|
```
PollData
```
### quarantined​
#### Get Signature​
get quarantined():
```
boolean
```
##### Returns​
```
boolean
```
### removed​
#### Get Signature​
get removed():
```
boolean
```
##### Returns​
```
boolean
```
### removedBy​
#### Get Signature​
get removedBy():
```
undefined
```
|
```
string
```
Who removed this object (username)
##### Returns​
```
undefined
```
|
```
string
```
### removedByCategory​
#### Get Signature​
get removedByCategory():
```
undefined
```
|
```
string
```
who/what removed this object. It will return one of the following:
"anti_evil_ops": object is removed by a aeops member
"author": object is removed by author of the post
"automod_filtered": object is filtered by automod
"community_ops": object is removed by a community team member
"content_takedown": object is removed due to content violation
"copyright_takedown": object is removed due to copyright violation
"deleted": object is deleted
"moderator": object is removed by a mod of the sub
"reddit": object is removed by anyone else
undefined: object is not removed
##### Returns​
```
undefined
```
|
```
string
```
### score​
#### Get Signature​
get score():
```
number
```
##### Returns​
```
number
```
### secureMedia​
#### Get Signature​
get secureMedia():
```
undefined
```
|
```
SecureMedia
```
##### Returns​
```
undefined
```
|
```
SecureMedia
```
### spam​
#### Get Signature​
get spam():
```
boolean
```
##### Returns​
```
boolean
```
### spoiler​
#### Get Signature​
get spoiler():
```
boolean
```
##### Returns​
```
boolean
```
### stickied​
#### Get Signature​
get stickied():
```
boolean
```
##### Returns​
```
boolean
```
### subredditId​
#### Get Signature​
get subredditId():
```
`t5_${string}`
```
##### Returns​
```
`t5_${string}`
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
### thumbnail​
#### Get Signature​
get thumbnail():
```
undefined
```
| {
```
height
```
:
```
number
```
;
```
url
```
:
```
string
```
;
```
width
```
:
```
number
```
; }
##### Returns​
```
undefined
```
| {
```
height
```
:
```
number
```
;
```
url
```
:
```
string
```
;
```
width
```
:
```
number
```
; }
### title​
#### Get Signature​
get title():
```
string
```
##### Returns​
```
string
```
### url​
#### Get Signature​
get url():
```
string
```
##### Returns​
```
string
```
### userReportReasons​
#### Get Signature​
get userReportReasons():
```
string
```
[]
##### Returns​
```
string
```
[]
## Methods​
### addComment()​
addComment(
```
options
```
):
```
Promise
```
<
```
Comment
```
>
#### Parameters​
##### options​
```
CommentSubmissionOptions
```
#### Returns​
```
Promise
```
<
```
Comment
```
>
### addRemovalNote()​
addRemovalNote(
```
options
```
):
```
Promise
```
<
```
void
```
>
Add a mod note for why the post was removed
#### Parameters​
##### options​
###### modNote?​
```
string
```
the reason for removal (maximum 100 characters) (optional)
###### reasonId​
```
string
```
id of a Removal Reason - you can leave this as an empty string if you don't have one
#### Returns​
```
Promise
```
<
```
void
```
>
### approve()​
approve():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### crosspost()​
crosspost(
```
options
```
):
```
Promise
```
<
```
Post
```
>
#### Parameters​
##### options​
```
Omit
```
<
```
CrosspostOptions
```
,
```
"postId"
```
>
#### Returns​
```
Promise
```
<
```
Post
```
>
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### distinguish()​
distinguish():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### distinguishAsAdmin()​
distinguishAsAdmin():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### edit()​
edit(
```
options
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### options​
```
PostTextOptions
```
#### Returns​
```
Promise
```
<
```
void
```
>
### getAuthor()​
getAuthor():
```
Promise
```
<
```
undefined
```
|
```
User
```
>
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
User
```
>
### getCurrentUserPollOption()​
getCurrentUserPollOption():
```
Promise
```
<
```
undefined
```
|
```
PollOption
```
>
Get the poll option the authenticated user selected for this post.
Returns undefined if the post is not a poll or the user has not voted.
This method will get the poll option for the app account by default.
To get the poll option for a user, please contact Reddit.
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
PollOption
```
>
### getDuplicates()​
getDuplicates(
```
options
```
):
```
Listing
```
<
```
Post
```
>
#### Parameters​
##### options​
```
Omit
```
<
```
GetDuplicatesOptions
```
,
```
"postId"
```
> =
```
{}
```
#### Returns​
```
Listing
```
<
```
Post
```
>
### getEnrichedThumbnail()​
getEnrichedThumbnail():
```
Promise
```
<
```
undefined
```
|
```
EnrichedThumbnail
```
>
Get a thumbnail that contains a preview image and also contains a blurred preview for
NSFW images. The thumbnail returned has higher resolution than Post.thumbnail.
Returns undefined if the post doesn't have a thumbnail
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
EnrichedThumbnail
```
>
#### Throws​
Throws an error if the thumbnail could not be fetched
#### Example​
```
// from a menu action, form, scheduler, trigger, custom post click event, etcconst post = await context.reddit.getPostById(context.postId);const enrichedThumbnail = await post.getEnrichedThumbnail();
```
### getPostData()​
getPostData():
```
Promise
```
<
```
undefined
```
|
```
JsonObject
```
>
Get the postData for the post.
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
JsonObject
```
>
#### Example​
```
const post = await context.reddit.getPostById(context.postId);const postData = await post.getPostData();
```
### hide()​
hide():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### ignoreReports()​
ignoreReports():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### isApproved()​
isApproved():
```
boolean
```
#### Returns​
```
boolean
```
### isArchived()​
isArchived():
```
boolean
```
#### Returns​
```
boolean
```
### isDistinguishedBy()​
isDistinguishedBy():
```
undefined
```
|
```
string
```
#### Returns​
```
undefined
```
|
```
string
```
### isEdited()​
isEdited():
```
boolean
```
#### Returns​
```
boolean
```
### isHidden()​
isHidden():
```
boolean
```
#### Returns​
```
boolean
```
### isIgnoringReports()​
isIgnoringReports():
```
boolean
```
#### Returns​
```
boolean
```
### isLocked()​
isLocked():
```
boolean
```
#### Returns​
```
boolean
```
### isNsfw()​
isNsfw():
```
boolean
```
#### Returns​
```
boolean
```
### isQuarantined()​
isQuarantined():
```
boolean
```
#### Returns​
```
boolean
```
### isRemoved()​
isRemoved():
```
boolean
```
#### Returns​
```
boolean
```
### isSpam()​
isSpam():
```
boolean
```
#### Returns​
```
boolean
```
### isSpoiler()​
isSpoiler():
```
boolean
```
#### Returns​
```
boolean
```
### isStickied()​
isStickied():
```
boolean
```
#### Returns​
```
boolean
```
### lock()​
lock():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### markAsNsfw()​
markAsNsfw():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### markAsSpoiler()​
markAsSpoiler():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### remove()​
remove(
```
isSpam
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### isSpam​
```
boolean
```
=
```
false
```
#### Returns​
```
Promise
```
<
```
void
```
>
### setCustomPostPreview()​
setCustomPostPreview(
```
ui
```
):
```
Promise
```
<
```
void
```
>
Set a lightweight UI that shows while the custom post renders
#### Parameters​
##### ui​
```
ComponentFunction
```
A JSX component function that returns a simple ui to be rendered.
#### Returns​
```
Promise
```
<
```
void
```
>
#### Throws​
Throws an error if the preview could not be set.
#### Example​
```
const preview = ( <vstack height="100%" width="100%" alignment="middle center"> <text size="large">An updated preview!</text> </vstack>);const post = await reddit.getPostById(context.postId);await post.setCustomPostPreview(() => preview);
```
### setPostData()​
setPostData(
```
postData
```
):
```
Promise
```
<
```
void
```
>
Set the postData on a custom post.
#### Parameters​
##### postData​
```
JsonObject
```
Represents the postData to be set, eg: { currentScore: 55, secretWord: 'barbeque' }
#### Returns​
```
Promise
```
<
```
void
```
>
#### Throws​
Throws an error if the postData could not be set.
#### Example​
```
const post = await reddit.getPostById(context.postId);await post.setPostData({ currentScore: 55, secretWord: 'barbeque',});
```
### setSuggestedCommentSort()​
setSuggestedCommentSort(
```
suggestedSort
```
):
```
Promise
```
<
```
void
```
>
Set the suggested sort for comments on a Post.
#### Parameters​
##### suggestedSort​
```
PostSuggestedCommentSort
```
#### Returns​
```
Promise
```
<
```
void
```
>
#### Throws​
Throws an error if the suggested sort could not be set.
#### Example​
```
const post = await reddit.getPostById(context.postId);await post.setSuggestedCommentSort("NEW");
```
### setTextFallback()​
setTextFallback(
```
options
```
):
```
Promise
```
<
```
void
```
>
Set a text fallback for the custom post
#### Parameters​
##### options​
```
CustomPostTextFallbackOptions
```
A text or a richtext to render in a fallback
#### Returns​
```
Promise
```
<
```
void
```
>
#### Throws​
Throws an error if the fallback could not be set.
#### Example​
```
// from a menu action, form, scheduler, trigger, custom post click event, etcconst newTextFallback = { text: 'This is an updated text fallback' };const post = await context.reddit.getPostById(context.postId);await post.setTextFallback(newTextFallback);
```
### snoozeReports()​
snoozeReports(
```
reason
```
):
```
Promise
```
<
```
void
```
>
Snooze subsequent reports with the given reason from the same users for the next 7 days.
Only works for free-form reports.
#### Parameters​
##### reason​
```
string
```
The report reason to snooze.
#### Returns​
```
Promise
```
<
```
void
```
>
### sticky()​
sticky(
```
position
```
?):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### position?​
```
1
```
|
```
2
```
|
```
3
```
|
```
4
```
#### Returns​
```
Promise
```
<
```
void
```
>
### toJSON()​
toJSON():
```
Pick
```
<
```
Post
```
,
```
"subredditName"
```
|
```
"flair"
```
|
```
"id"
```
|
```
"score"
```
|
```
"title"
```
|
```
"subredditId"
```
|
```
"url"
```
|
```
"createdAt"
```
|
```
"nsfw"
```
|
```
"permalink"
```
|
```
"authorId"
```
|
```
"authorName"
```
|
```
"body"
```
|
```
"bodyHtml"
```
|
```
"thumbnail"
```
|
```
"numberOfComments"
```
|
```
"numberOfReports"
```
|
```
"approved"
```
|
```
"spam"
```
|
```
"stickied"
```
|
```
"removed"
```
|
```
"removedBy"
```
|
```
"removedByCategory"
```
|
```
"archived"
```
|
```
"edited"
```
|
```
"locked"
```
|
```
"quarantined"
```
|
```
"spoiler"
```
|
```
"hidden"
```
|
```
"ignoringReports"
```
|
```
"distinguishedBy"
```
|
```
"authorFlair"
```
|
```
"secureMedia"
```
|
```
"userReportReasons"
```
|
```
"modReportReasons"
```
>
#### Returns​
```
Pick
```
<
```
Post
```
,
```
"subredditName"
```
|
```
"flair"
```
|
```
"id"
```
|
```
"score"
```
|
```
"title"
```
|
```
"subredditId"
```
|
```
"url"
```
|
```
"createdAt"
```
|
```
"nsfw"
```
|
```
"permalink"
```
|
```
"authorId"
```
|
```
"authorName"
```
|
```
"body"
```
|
```
"bodyHtml"
```
|
```
"thumbnail"
```
|
```
"numberOfComments"
```
|
```
"numberOfReports"
```
|
```
"approved"
```
|
```
"spam"
```
|
```
"stickied"
```
|
```
"removed"
```
|
```
"removedBy"
```
|
```
"removedByCategory"
```
|
```
"archived"
```
|
```
"edited"
```
|
```
"locked"
```
|
```
"quarantined"
```
|
```
"spoiler"
```
|
```
"hidden"
```
|
```
"ignoringReports"
```
|
```
"distinguishedBy"
```
|
```
"authorFlair"
```
|
```
"secureMedia"
```
|
```
"userReportReasons"
```
|
```
"modReportReasons"
```
>
### undistinguish()​
undistinguish():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### unhide()​
unhide():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### unignoreReports()​
unignoreReports():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### unlock()​
unlock():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### unmarkAsNsfw()​
unmarkAsNsfw():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### unmarkAsSpoiler()​
unmarkAsSpoiler():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### unsnoozeReports()​
unsnoozeReports(
```
reason
```
):
```
Promise
```
<
```
void
```
>
Unsnooze reports with the given reason.
Only works for free-form reports.
#### Parameters​
##### reason​
```
string
```
The report reason to unsnooze.
#### Returns​
```
Promise
```
<
```
void
```
>
### unsticky()​
unsticky():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### updateCrowdControlLevel()​
updateCrowdControlLevel(
```
level
```
):
```
Promise
```
<
```
void
```
>
Updates the crowd control level of the post to hide comments accordingly.
#### Parameters​
##### level​
```
CrowdControlLevel
```
The crowd control level to set. See CrowdControlLevel for more information.
#### Returns​
```
Promise
```
<
```
void
```
>
Previous
ModNote
Next
PostFlairSettings
Accessors
approved
approvedAtUtc
archived
authorFlair
authorId
authorName
bannedAtUtc
body
bodyHtml
comments
createdAt
distinguishedBy
edited
flair
gallery
hidden
id
ignoringReports
locked
modReportReasons
nsfw
numberOfComments
numberOfReports
permalink
pollData
quarantined
removed
removedBy
removedByCategory
score
secureMedia
spam
spoiler
stickied
subredditId
subredditName
thumbnail
title
url
userReportReasons
Methods
addComment()
addRemovalNote()
approve()
crosspost()
delete()
distinguish()
distinguishAsAdmin()
edit()
getAuthor()
getCurrentUserPollOption()
getDuplicates()
getEnrichedThumbnail()
getPostData()
hide()
ignoreReports()
isApproved()
isArchived()
isDistinguishedBy()
isEdited()
isHidden()
isIgnoringReports()
isLocked()
isNsfw()
isQuarantined()
isRemoved()
isSpam()
isSpoiler()
isStickied()
lock()
markAsNsfw()
markAsSpoiler()
remove()
setCustomPostPreview()
setPostData()
setSuggestedCommentSort()
setTextFallback()
snoozeReports()
sticky()
toJSON()
undistinguish()
unhide()
unignoreReports()
unlock()
unmarkAsNsfw()
unmarkAsSpoiler()
unsnoozeReports()
unsticky()
updateCrowdControlLevel()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.13 PostFlairSettings

PostFlairSettings | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
PostFlairSettings
On this page
# PostFlairSettings
@devvit/public-api v0.12.20-dev
# Class: PostFlairSettings
## Constructors​
### new PostFlairSettings()​
new PostFlairSettings():
```
PostFlairSettings
```
#### Returns​
```
PostFlairSettings
```
## Properties​
### isEnabled?​
```
optional
```
isEnabled:
```
boolean
```
### isSelfAssignabled?​
```
optional
```
isSelfAssignabled:
```
boolean
```
Previous
Post
Next
PostFlairWidget
Constructors
new PostFlairSettings()
Properties
isEnabled?
isSelfAssignabled?
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.14 PostFlairWidget

PostFlairWidget | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
PostFlairWidget
On this page
# PostFlairWidget
@devvit/public-api v0.12.20-dev
# Class: PostFlairWidget
## Extends​
```
Widget
```
## Constructors​
### new PostFlairWidget()​
new PostFlairWidget(
```
widgetData
```
,
```
subredditName
```
,
```
metadata
```
):
```
PostFlairWidget
```
#### Parameters​
##### widgetData​
```
GetWidgetsResponse_WidgetItem
```
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
PostFlairWidget
```
#### Overrides​
```
Widget
```
.
```
constructor
```
## Accessors​
### display​
#### Get Signature​
get display():
```
"list"
```
|
```
"cloud"
```
##### Returns​
```
"list"
```
|
```
"cloud"
```
### id​
#### Get Signature​
get id():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
id
```
### name​
#### Get Signature​
get name():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
name
```
### styles​
#### Get Signature​
get styles():
```
WidgetStyles
```
##### Returns​
```
WidgetStyles
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
subredditName
```
### templates​
#### Get Signature​
get templates():
```
GetWidgetsResponse_WidgetItem_PostFlairTemplate
```
[]
##### Returns​
```
GetWidgetsResponse_WidgetItem_PostFlairTemplate
```
[]
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
#### Inherited from​
```
Widget
```
.
```
delete
```
### toJSON()​
toJSON():
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
PostFlairWidget
```
,
```
"styles"
```
|
```
"templates"
```
|
```
"display"
```
>
#### Returns​
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
PostFlairWidget
```
,
```
"styles"
```
|
```
"templates"
```
|
```
"display"
```
>
#### Overrides​
```
Widget
```
.
```
toJSON
```
Previous
PostFlairSettings
Next
PrivateMessage
Extends
Constructors
new PostFlairWidget()
Accessors
display
id
name
styles
subredditName
templates
Methods
delete()
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.15 PrivateMessage

PrivateMessage | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
PrivateMessage
On this page
# PrivateMessage
@devvit/public-api v0.12.20-dev
# Class: PrivateMessage
## Accessors​
### body​
#### Get Signature​
get body():
```
string
```
##### Returns​
```
string
```
### bodyHtml​
#### Get Signature​
get bodyHtml():
```
string
```
##### Returns​
```
string
```
### created​
#### Get Signature​
get created():
```
Date
```
##### Returns​
```
Date
```
### from​
#### Get Signature​
get from():
```
PrivateMessageAuthor
```
##### Returns​
```
PrivateMessageAuthor
```
### id​
#### Get Signature​
get id():
```
TID
```
##### Returns​
```
TID
```
## Methods​
### markAsRead()​
markAsRead():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
Previous
PostFlairWidget
Next
Rule
Accessors
body
bodyHtml
created
from
id
Methods
markAsRead()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.16 Rule

Rule | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
Rule
On this page
# Rule
@devvit/public-api v0.12.20-dev
# Class: Rule
## Constructors​
### new Rule()​
new Rule(
```
ruleData
```
,
```
subredditName
```
,
```
metadata
```
):
```
Rule
```
#### Parameters​
##### ruleData​
```
SubredditAboutRulesResponse_SubredditRule
```
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
Rule
```
## Accessors​
### createdUtc​
#### Get Signature​
get createdUtc():
```
number
```
The Unix timestamp of when the rule was created.
##### Returns​
```
number
```
### description​
#### Get Signature​
get description():
```
string
```
The full description of the rule. This appears on your subreddit's sidebar.
##### Returns​
```
string
```
### descriptionHtml​
#### Get Signature​
get descriptionHtml():
```
undefined
```
|
```
string
```
##### Returns​
```
undefined
```
|
```
string
```
### kind​
#### Get Signature​
get kind():
```
"all"
```
|
```
"link"
```
|
```
"comment"
```
Which Reddit objects this rule applies to. One of "all", "link" (AKA posts), "comment".
##### Returns​
```
"all"
```
|
```
"link"
```
|
```
"comment"
```
### priority​
#### Get Signature​
get priority():
```
number
```
The zero-indexed rank of the rule on the subreddit sidebar. Lower numbers appear on top.
##### Returns​
```
number
```
### shortName​
#### Get Signature​
get shortName():
```
string
```
The name for the rule.
##### Returns​
```
string
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
The name (without r/ prefix) of the subreddit the rule belongs to.
##### Returns​
```
string
```
### violationReason​
#### Get Signature​
get violationReason():
```
string
```
Text to show users when reporting content due to this rule. Defaults to the shortName.
##### Returns​
```
string
```
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### toJSON()​
toJSON():
```
Pick
```
<
```
Rule
```
,
```
"subredditName"
```
|
```
"kind"
```
|
```
"violationReason"
```
|
```
"shortName"
```
|
```
"description"
```
|
```
"createdUtc"
```
|
```
"priority"
```
> &
```
object
```
#### Returns​
```
Pick
```
<
```
Rule
```
,
```
"subredditName"
```
|
```
"kind"
```
|
```
"violationReason"
```
|
```
"shortName"
```
|
```
"description"
```
|
```
"createdUtc"
```
|
```
"priority"
```
> &
```
object
```
### update()​
update(
```
options
```
):
```
Promise
```
<
```
void
```
>
Update an existing rule.
#### Parameters​
##### options​
```
Readonly
```
<
```
UpdateRuleOptions
```
>
New values for an existing rule. All fields are optional. If a field is not provided, the existing value will not be changed.
#### Returns​
```
Promise
```
<
```
void
```
>
### createRule()​
```
static
```
createRule(
```
subredditName
```
,
```
options
```
,
```
metadata
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### subredditName​
```
string
```
##### options​
```
Readonly
```
<
```
CreateRuleOptions
```
>
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
Promise
```
<
```
void
```
>
### delete()​
```
static
```
delete(
```
subredditName
```
,
```
shortName
```
,
```
metadata
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### subredditName​
```
string
```
##### shortName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
Promise
```
<
```
void
```
>
### getRules()​
```
static
```
getRules(
```
subredditName
```
,
```
metadata
```
):
```
Promise
```
<
```
Rule
```
[]>
#### Parameters​
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
Promise
```
<
```
Rule
```
[]>
### reorderRules()​
```
static
```
reorderRules(
```
subredditName
```
,
```
rules
```
,
```
metadata
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### subredditName​
```
string
```
##### rules​
```
Rule
```
[]
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
Promise
```
<
```
void
```
>
Previous
PrivateMessage
Next
Subreddit
Constructors
new Rule()
Accessors
createdUtc
description
descriptionHtml
kind
priority
shortName
subredditName
violationReason
Methods
delete()
toJSON()
update()
createRule()
delete()
getRules()
reorderRules()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.17 Subreddit

Subreddit | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
Subreddit
On this page
# Subreddit
@devvit/public-api v0.12.20-dev
# Class: Subreddit
A class representing a subreddit.
## Accessors​
### createdAt​
#### Get Signature​
get createdAt():
```
Date
```
The creation date of the subreddit.
##### Returns​
```
Date
```
### description​
#### Get Signature​
get description():
```
undefined
```
|
```
string
```
The description of the subreddit.
##### Returns​
```
undefined
```
|
```
string
```
### id​
#### Get Signature​
get id():
```
`t5_${string}`
```
The ID (starting with t5_) of the subreddit to retrieve. e.g. t5_2qjpg
##### Returns​
```
`t5_${string}`
```
### language​
#### Get Signature​
get language():
```
string
```
The language of the subreddit.
##### Returns​
```
string
```
### name​
#### Get Signature​
get name():
```
string
```
The name of a subreddit omitting the r/.
##### Returns​
```
string
```
### nsfw​
#### Get Signature​
get nsfw():
```
boolean
```
Whether the subreddit is marked as NSFW (Not Safe For Work).
##### Returns​
```
boolean
```
### numberOfActiveUsers​
#### Get Signature​
get numberOfActiveUsers():
```
number
```
The number of active users of the subreddit.
##### Returns​
```
number
```
### numberOfSubscribers​
#### Get Signature​
get numberOfSubscribers():
```
number
```
The number of subscribers of the subreddit.
##### Returns​
```
number
```
### permalink​
#### Get Signature​
get permalink():
```
string
```
Returns a permalink path
(R2 bug: subreddit.url is a permalink, and does not have a subreddit.permalink field)
##### Returns​
```
string
```
### postFlairsEnabled​
#### Get Signature​
get postFlairsEnabled():
```
boolean
```
Whether the post flairs are enabled for this subreddit.
##### Returns​
```
boolean
```
### settings​
#### Get Signature​
get settings():
```
SubredditSettings
```
The settings of the subreddit.
##### Returns​
```
SubredditSettings
```
### title​
#### Get Signature​
get title():
```
undefined
```
|
```
string
```
The title of the subreddit.
##### Returns​
```
undefined
```
|
```
string
```
### type​
#### Get Signature​
get type():
```
SubredditType
```
The type of subreddit (public, private, etc.).
##### Returns​
```
SubredditType
```
### url​
#### Get Signature​
get url():
```
string
```
Returns the HTTP URL for the subreddit.
(R2 bug: subreddit.url is a permalink path and does not return a fully qualified URL in subreddit.url)
##### Returns​
```
string
```
### userFlairsEnabled​
#### Get Signature​
get userFlairsEnabled():
```
boolean
```
Whether the user flairs are enabled for this subreddit.
##### Returns​
```
boolean
```
### usersCanAssignPostFlairs​
#### Get Signature​
get usersCanAssignPostFlairs():
```
boolean
```
Whether the user can assign post flairs.
This is only true if the post flairs are enabled.
##### Returns​
```
boolean
```
### usersCanAssignUserFlairs​
#### Get Signature​
get usersCanAssignUserFlairs():
```
boolean
```
Whether the user can assign user flairs.
This is only true if the user flairs are enabled.
##### Returns​
```
boolean
```
## Methods​
### addRemovalReason()​
addRemovalReason(
```
options
```
):
```
Promise
```
<
```
string
```
>
Add a removal reason to this subreddit.
#### Parameters​
##### options​
###### message​
```
string
```
The message associated with the removal reason.
###### title​
```
string
```
The title of the removal reason.
#### Returns​
```
Promise
```
<
```
string
```
>
The new removal reason ID.
### addWikiContributor()​
addWikiContributor(
```
username
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### approveUser()​
approveUser(
```
username
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### banUser()​
banUser(
```
options
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### options​
```
Omit
```
<
```
BanUserOptions
```
,
```
"subredditName"
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### banWikiContributor()​
banWikiContributor(
```
options
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### options​
```
Omit
```
<
```
BanWikiContributorOptions
```
,
```
"subredditName"
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### createPostFlairTemplate()​
createPostFlairTemplate(
```
options
```
):
```
Promise
```
<
```
FlairTemplate
```
>
#### Parameters​
##### options​
```
Omit
```
<
```
CreateFlairTemplateOptions
```
,
```
"subredditName"
```
>
#### Returns​
```
Promise
```
<
```
FlairTemplate
```
>
### createRule()​
createRule(
```
options
```
):
```
Promise
```
<
```
void
```
>
Create a new subreddit rule.
#### Parameters​
##### options​
```
Readonly
```
<
```
CreateRuleOptions
```
>
Options for creating a new subreddit rule.
#### Returns​
```
Promise
```
<
```
void
```
>
### createUserFlairTemplate()​
createUserFlairTemplate(
```
options
```
):
```
Promise
```
<
```
FlairTemplate
```
>
#### Parameters​
##### options​
```
Omit
```
<
```
CreateFlairTemplateOptions
```
,
```
"subredditName"
```
>
#### Returns​
```
Promise
```
<
```
FlairTemplate
```
>
### deleteRemovalReason()​
deleteRemovalReason(
```
reasonId
```
):
```
Promise
```
<
```
void
```
>
Delete a removal reason from this subreddit.
#### Parameters​
##### reasonId​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### getApprovedUsers()​
getApprovedUsers(
```
options
```
):
```
Listing
```
<
```
User
```
>
#### Parameters​
##### options​
```
GetUsersOptions
```
=
```
{}
```
#### Returns​
```
Listing
```
<
```
User
```
>
### getBannedUsers()​
getBannedUsers(
```
options
```
):
```
Listing
```
<
```
User
```
>
#### Parameters​
##### options​
```
GetUsersOptions
```
=
```
{}
```
#### Returns​
```
Listing
```
<
```
User
```
>
### getBannedWikiContributors()​
getBannedWikiContributors(
```
options
```
):
```
Listing
```
<
```
User
```
>
#### Parameters​
##### options​
```
GetUsersOptions
```
=
```
{}
```
#### Returns​
```
Listing
```
<
```
User
```
>
### getCommentsAndPostsByIds()​
getCommentsAndPostsByIds(
```
ids
```
):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things specified by their fullnames.
#### Parameters​
##### ids​
```
string
```
[]
Array of thing full ids (e.g. t3_abc123)
#### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
#### Example​
```
const subreddit = await reddit.getSubredditByName('askReddit');const listing = subreddit.getCommentsAndPostsByIds(['t3_abc123', 't1_xyz123']);const items = await listing.all();console.log(items) // [Post, Comment]
```
### getControversialPosts()​
getControversialPosts(
```
options
```
):
```
Listing
```
<
```
Post
```
>
#### Parameters​
##### options​
```
Omit
```
<
```
GetPostsOptionsWithTimeframe
```
,
```
"subredditName"
```
> =
```
{}
```
#### Returns​
```
Listing
```
<
```
Post
```
>
### getEdited()​
#### Call Signature​
getEdited(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Return a listing of things that have been edited recently.
##### Parameters​
###### options​
```
AboutSubredditOptions
```
<
```
"comment"
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getEdited();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getEdited({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getEdited(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Return a listing of things that have been edited recently.
##### Parameters​
###### options​
```
AboutSubredditOptions
```
<
```
"post"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getEdited();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getEdited({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getEdited(
```
options
```
?):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things that have been edited recently.
##### Parameters​
###### options?​
```
AboutSubredditOptions
```
<
```
"all"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getEdited();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getEdited({ type: "post"});console.log("Posts: ", await listing.all())
```
### getModerationLog()​
getModerationLog(
```
options
```
):
```
Listing
```
<
```
ModAction
```
>
#### Parameters​
##### options​
```
GetModerationLogOptions
```
#### Returns​
```
Listing
```
<
```
ModAction
```
>
### getModerators()​
getModerators(
```
options
```
):
```
Listing
```
<
```
User
```
>
#### Parameters​
##### options​
```
GetUsersOptions
```
=
```
{}
```
#### Returns​
```
Listing
```
<
```
User
```
>
### getModQueue()​
#### Call Signature​
getModQueue(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Return a listing of things requiring moderator review, such as reported things and items.
##### Parameters​
###### options​
```
AboutSubredditOptions
```
<
```
"comment"
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getModQueue();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getModQueue({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getModQueue(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Return a listing of things requiring moderator review, such as reported things and items.
##### Parameters​
###### options​
```
AboutSubredditOptions
```
<
```
"post"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getModQueue();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getModQueue({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getModQueue(
```
options
```
?):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things requiring moderator review, such as reported things and items.
##### Parameters​
###### options?​
```
AboutSubredditOptions
```
<
```
"all"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getModQueue();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getModQueue({ type: "post"});console.log("Posts: ", await listing.all())
```
### getMutedUsers()​
getMutedUsers(
```
options
```
):
```
Listing
```
<
```
User
```
>
#### Parameters​
##### options​
```
GetUsersOptions
```
=
```
{}
```
#### Returns​
```
Listing
```
<
```
User
```
>
### getPostFlairTemplates()​
getPostFlairTemplates():
```
Promise
```
<
```
FlairTemplate
```
[]>
#### Returns​
```
Promise
```
<
```
FlairTemplate
```
[]>
### getRemovalReasons()​
getRemovalReasons():
```
Promise
```
<
```
RemovalReason
```
[]>
Get the list of this subreddit's removal reasons (ordered).
#### Returns​
```
Promise
```
<
```
RemovalReason
```
[]>
### getReports()​
#### Call Signature​
getReports(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Return a listing of things that have been reported.
##### Parameters​
###### options​
```
AboutSubredditOptions
```
<
```
"comment"
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getReports();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getReports({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getReports(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Return a listing of things that have been reported.
##### Parameters​
###### options​
```
AboutSubredditOptions
```
<
```
"post"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getReports();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getReports({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getReports(
```
options
```
?):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things that have been reported.
##### Parameters​
###### options?​
```
AboutSubredditOptions
```
<
```
"all"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getReports();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getReports({ type: "post"});console.log("Posts: ", await listing.all())
```
### getRules()​
getRules():
```
Promise
```
<
```
Rule
```
[]>
#### Returns​
```
Promise
```
<
```
Rule
```
[]>
### getSpam()​
#### Call Signature​
getSpam(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Return a listing of things that have been marked as spam or otherwise removed.
##### Parameters​
###### options​
```
AboutSubredditOptions
```
<
```
"comment"
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getSpam();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getSpam({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getSpam(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Return a listing of things that have been marked as spam or otherwise removed.
##### Parameters​
###### options​
```
AboutSubredditOptions
```
<
```
"post"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getSpam();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getSpam({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getSpam(
```
options
```
?):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things that have been marked as spam or otherwise removed.
##### Parameters​
###### options?​
```
AboutSubredditOptions
```
<
```
"all"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getSpam();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getSpam({ type: "post"});console.log("Posts: ", await listing.all())
```
### getTopPosts()​
getTopPosts(
```
options
```
):
```
Listing
```
<
```
Post
```
>
#### Parameters​
##### options​
```
Omit
```
<
```
GetPostsOptionsWithTimeframe
```
,
```
"subredditName"
```
> =
```
{}
```
#### Returns​
```
Listing
```
<
```
Post
```
>
### getUnmoderated()​
#### Call Signature​
getUnmoderated(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Return a listing of things that have yet to be approved/removed by a mod.
##### Parameters​
###### options​
```
AboutSubredditOptions
```
<
```
"comment"
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getUnmoderated();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getUnmoderated({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getUnmoderated(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Return a listing of things that have yet to be approved/removed by a mod.
##### Parameters​
###### options​
```
AboutSubredditOptions
```
<
```
"post"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getUnmoderated();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getUnmoderated({ type: "post"});console.log("Posts: ", await listing.all())
```
#### Call Signature​
getUnmoderated(
```
options
```
?):
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
Return a listing of things that have yet to be approved/removed by a mod.
##### Parameters​
###### options?​
```
AboutSubredditOptions
```
<
```
"all"
```
>
##### Returns​
```
Listing
```
<
```
Post
```
|
```
Comment
```
>
##### Example​
```
const subreddit = await reddit.getSubredditByName("mysubreddit")let listing = await subreddit.getUnmoderated();console.log("Posts and Comments: ", await listing.all())listing = await subreddit.getUnmoderated({ type: "post"});console.log("Posts: ", await listing.all())
```
### getUserFlair()​
getUserFlair(
```
options
```
?):
```
Promise
```
<
```
GetUserFlairBySubredditResponse
```
>
Get the user flair for the given subreddit. If
```
usernames
```
is provided then it will return only the
flair for the specified users. If retrieving the list of flair for a given subreddit and the list is long
then this method will return a
```
next
```
field which can be passed into the
```
after
```
field on the next call to
retrieve the next slice of data. To retrieve the previous slice of data pass the
```
prev
```
field into the
```
before
```
field
during the subsequent call.
#### Parameters​
##### options?​
```
GetUserFlairOptions
```
See interface
#### Returns​
```
Promise
```
<
```
GetUserFlairBySubredditResponse
```
>
#### Examples​
```
const subredditName = "mysubreddit"const subreddit = await reddit.getSubredditByName(subredditName)const response = await subreddit.getUserFlair();const userFlairList = response.users
```
```
const response = await subreddit.getUserFlair({ after: "t2_awefae"});const userFlairList = response.users
```
```
const response = await subreddit.getUserFlair({ usernames: ['toxictoad', 'badapple']});const userFlairList = response.users
```
### getUserFlairTemplates()​
getUserFlairTemplates():
```
Promise
```
<
```
FlairTemplate
```
[]>
#### Returns​
```
Promise
```
<
```
FlairTemplate
```
[]>
### getWikiContributors()​
getWikiContributors(
```
options
```
):
```
Listing
```
<
```
User
```
>
#### Parameters​
##### options​
```
GetUsersOptions
```
=
```
{}
```
#### Returns​
```
Listing
```
<
```
User
```
>
### inviteModerator()​
inviteModerator(
```
username
```
,
```
permissions
```
?):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
##### permissions?​
```
ModeratorPermission
```
[]
#### Returns​
```
Promise
```
<
```
void
```
>
### muteUser()​
muteUser(
```
username
```
,
```
note
```
?):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
##### note?​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### removeModerator()​
removeModerator(
```
username
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### removeUser()​
removeUser(
```
username
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### removeWikiContributor()​
removeWikiContributor(
```
username
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### reorderRules()​
reorderRules(
```
rules
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### rules​
```
Rule
```
[]
#### Returns​
```
Promise
```
<
```
void
```
>
### revokeModeratorInvite()​
revokeModeratorInvite(
```
username
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### setModeratorPermissions()​
setModeratorPermissions(
```
username
```
,
```
permissions
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
##### permissions​
```
ModeratorPermission
```
[]
#### Returns​
```
Promise
```
<
```
void
```
>
### submitPost()​
submitPost(
```
options
```
):
```
Promise
```
<
```
Post
```
>
#### Parameters​
##### options​
```
SubmitLinkOptions
```
|
```
SubmitSelfPostOptions
```
#### Returns​
```
Promise
```
<
```
Post
```
>
### toJSON()​
toJSON():
```
Pick
```
<
```
Subreddit
```
,
```
"type"
```
|
```
"description"
```
|
```
"id"
```
|
```
"name"
```
|
```
"title"
```
|
```
"settings"
```
|
```
"createdAt"
```
|
```
"language"
```
|
```
"numberOfSubscribers"
```
|
```
"numberOfActiveUsers"
```
|
```
"nsfw"
```
>
#### Returns​
```
Pick
```
<
```
Subreddit
```
,
```
"type"
```
|
```
"description"
```
|
```
"id"
```
|
```
"name"
```
|
```
"title"
```
|
```
"settings"
```
|
```
"createdAt"
```
|
```
"language"
```
|
```
"numberOfSubscribers"
```
|
```
"numberOfActiveUsers"
```
|
```
"nsfw"
```
>
### unbanUser()​
unbanUser(
```
username
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### unbanWikiContributor()​
unbanWikiContributor(
```
username
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### unmuteUser()​
unmuteUser(
```
username
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### updateRemovalReason()​
updateRemovalReason(
```
reasonId
```
,
```
options
```
):
```
Promise
```
<
```
void
```
>
Update a removal reason's title and message in this subreddit.
#### Parameters​
##### reasonId​
```
string
```
##### options​
###### message​
```
string
```
###### title​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### updateSettings()​
updateSettings(
```
options
```
):
```
Promise
```
<
```
void
```
>
Updates subreddit settings via the SiteAdmin API. Current settings are used as the base;
only provided options are applied. In order to reset a field to its default value,
pass the default value as the option value.
#### Parameters​
##### options​
```
SubredditSettingsOptions
```
Optional settings to apply. Omitted fields are left unchanged.
#### Returns​
```
Promise
```
<
```
void
```
>
#### Example​
```
const subreddit = await reddit.getSubredditByName('mysubreddit');await subreddit.updateSettings({ restrictPosting: true, allowImages: false });await subreddit.updateSettings({ type: 'restricted', title: 'New Title', description: 'Sidebar text' });
```
Previous
Rule
Next
SubredditDescription
Accessors
createdAt
description
id
language
name
nsfw
numberOfActiveUsers
numberOfSubscribers
permalink
postFlairsEnabled
settings
title
type
url
userFlairsEnabled
usersCanAssignPostFlairs
usersCanAssignUserFlairs
Methods
addRemovalReason()
addWikiContributor()
approveUser()
banUser()
banWikiContributor()
createPostFlairTemplate()
createRule()
createUserFlairTemplate()
deleteRemovalReason()
getApprovedUsers()
getBannedUsers()
getBannedWikiContributors()
getCommentsAndPostsByIds()
getControversialPosts()
getEdited()
getModerationLog()
getModerators()
getModQueue()
getMutedUsers()
getPostFlairTemplates()
getRemovalReasons()
getReports()
getRules()
getSpam()
getTopPosts()
getUnmoderated()
getUserFlair()
getUserFlairTemplates()
getWikiContributors()
inviteModerator()
muteUser()
removeModerator()
removeUser()
removeWikiContributor()
reorderRules()
revokeModeratorInvite()
setModeratorPermissions()
submitPost()
toJSON()
unbanUser()
unbanWikiContributor()
unmuteUser()
updateRemovalReason()
updateSettings()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.18 SubredditDescription

SubredditDescription | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
SubredditDescription
On this page
# SubredditDescription
@devvit/public-api v0.12.20-dev
# Class: SubredditDescription
## Constructors​
### new SubredditDescription()​
new SubredditDescription():
```
SubredditDescription
```
#### Returns​
```
SubredditDescription
```
## Properties​
### markdown?​
```
optional
```
markdown:
```
string
```
Previous
Subreddit
Next
SubredditRulesWidget
Constructors
new SubredditDescription()
Properties
markdown?
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.19 SubredditRulesWidget

SubredditRulesWidget | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
SubredditRulesWidget
On this page
# SubredditRulesWidget
@devvit/public-api v0.12.20-dev
# Class: SubredditRulesWidget
## Extends​
```
Widget
```
## Constructors​
### new SubredditRulesWidget()​
new SubredditRulesWidget(
```
subredditAboutRulesRsp
```
,
```
widgetData
```
,
```
subredditName
```
,
```
metadata
```
):
```
SubredditRulesWidget
```
#### Parameters​
##### subredditAboutRulesRsp​
```
SubredditAboutRulesResponse
```
##### widgetData​
```
GetWidgetsResponse_WidgetItem
```
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
SubredditRulesWidget
```
#### Overrides​
```
Widget
```
.
```
constructor
```
## Accessors​
### id​
#### Get Signature​
get id():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
id
```
### name​
#### Get Signature​
get name():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
name
```
### rules​
#### Get Signature​
get rules():
```
SubredditRule
```
[]
##### Returns​
```
SubredditRule
```
[]
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
subredditName
```
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
#### Inherited from​
```
Widget
```
.
```
delete
```
### toJSON()​
toJSON():
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
SubredditRulesWidget
```
,
```
"rules"
```
>
#### Returns​
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
SubredditRulesWidget
```
,
```
"rules"
```
>
#### Overrides​
```
Widget
```
.
```
toJSON
```
Previous
SubredditDescription
Next
SubredditWikiSettings
Extends
Constructors
new SubredditRulesWidget()
Accessors
id
name
rules
subredditName
Methods
delete()
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.2 ButtonWidget

ButtonWidget | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
ButtonWidget
On this page
# ButtonWidget
@devvit/public-api v0.12.20-dev
# Class: ButtonWidget
## Extends​
```
Widget
```
## Constructors​
### new ButtonWidget()​
new ButtonWidget(
```
widgetData
```
,
```
subredditName
```
,
```
metadata
```
):
```
ButtonWidget
```
#### Parameters​
##### widgetData​
```
GetWidgetsResponse_WidgetItem
```
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
ButtonWidget
```
#### Overrides​
```
Widget
```
.
```
constructor
```
## Accessors​
### buttons​
#### Get Signature​
get buttons():
```
WidgetButton
```
[]
##### Returns​
```
WidgetButton
```
[]
### description​
#### Get Signature​
get description():
```
string
```
##### Returns​
```
string
```
### id​
#### Get Signature​
get id():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
id
```
### name​
#### Get Signature​
get name():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
name
```
### styles​
#### Get Signature​
get styles():
```
WidgetStyles
```
##### Returns​
```
WidgetStyles
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
subredditName
```
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
#### Inherited from​
```
Widget
```
.
```
delete
```
### toJSON()​
toJSON():
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
ButtonWidget
```
,
```
"description"
```
|
```
"styles"
```
|
```
"buttons"
```
>
#### Returns​
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
ButtonWidget
```
,
```
"description"
```
|
```
"styles"
```
|
```
"buttons"
```
>
#### Overrides​
```
Widget
```
.
```
toJSON
```
Previous
AuthorFlairSettings
Next
CalendarWidget
Extends
Constructors
new ButtonWidget()
Accessors
buttons
description
id
name
styles
subredditName
Methods
delete()
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.20 SubredditWikiSettings

SubredditWikiSettings | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
SubredditWikiSettings
On this page
# SubredditWikiSettings
@devvit/public-api v0.12.20-dev
# Class: SubredditWikiSettings
## Constructors​
### new SubredditWikiSettings()​
new SubredditWikiSettings():
```
SubredditWikiSettings
```
#### Returns​
```
SubredditWikiSettings
```
## Properties​
### wikiEditMode?​
```
optional
```
wikiEditMode:
```
WikiEditMode
```
Previous
SubredditRulesWidget
Next
TextAreaWidget
Constructors
new SubredditWikiSettings()
Properties
wikiEditMode?
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.21 TextAreaWidget

TextAreaWidget | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
TextAreaWidget
On this page
# TextAreaWidget
@devvit/public-api v0.12.20-dev
# Class: TextAreaWidget
## Extends​
```
Widget
```
## Constructors​
### new TextAreaWidget()​
new TextAreaWidget(
```
widgetData
```
,
```
subredditName
```
,
```
metadata
```
):
```
TextAreaWidget
```
#### Parameters​
##### widgetData​
```
GetWidgetsResponse_WidgetItem
```
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
TextAreaWidget
```
#### Overrides​
```
Widget
```
.
```
constructor
```
## Accessors​
### id​
#### Get Signature​
get id():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
id
```
### name​
#### Get Signature​
get name():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
name
```
### styles​
#### Get Signature​
get styles():
```
WidgetStyles
```
##### Returns​
```
WidgetStyles
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
subredditName
```
### text​
#### Get Signature​
get text():
```
string
```
##### Returns​
```
string
```
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
#### Inherited from​
```
Widget
```
.
```
delete
```
### toJSON()​
toJSON():
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
TextAreaWidget
```
,
```
"text"
```
|
```
"styles"
```
>
#### Returns​
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
TextAreaWidget
```
,
```
"text"
```
|
```
"styles"
```
>
#### Overrides​
```
Widget
```
.
```
toJSON
```
Previous
SubredditWikiSettings
Next
User
Extends
Constructors
new TextAreaWidget()
Accessors
id
name
styles
subredditName
text
Methods
delete()
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.22 User

User | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
User
On this page
# User
@devvit/public-api v0.12.20-dev
# Class: User
A class representing a user.
## Accessors​
### about​
#### Get Signature​
get about():
```
string
```
The user's public description about themselves. May be empty.
##### Returns​
```
string
```
### commentKarma​
#### Get Signature​
get commentKarma():
```
number
```
The amount of comment karma the user has.
##### Returns​
```
number
```
### createdAt​
#### Get Signature​
get createdAt():
```
Date
```
The date the user was created.
##### Returns​
```
Date
```
### displayName​
#### Get Signature​
get displayName():
```
string
```
The display name of the user. May be different from their username.
##### Returns​
```
string
```
### hasVerifiedEmail​
#### Get Signature​
get hasVerifiedEmail():
```
boolean
```
Indicates whether or not the user has verified their email address.
##### Returns​
```
boolean
```
### id​
#### Get Signature​
get id():
```
`t2_${string}`
```
The ID (starting with t2_) of the user to retrieve.
##### Example​
```
't2_1w72'
```
##### Returns​
```
`t2_${string}`
```
### isAdmin​
#### Get Signature​
get isAdmin():
```
boolean
```
Whether the user is admin.
##### Returns​
```
boolean
```
### linkKarma​
#### Get Signature​
get linkKarma():
```
number
```
The amount of link karma the user has.
##### Returns​
```
number
```
### modPermissions​
#### Get Signature​
get modPermissions():
```
Map
```
<
```
string
```
,
```
ModeratorPermission
```
[]>
The permissions the user has on the subreddit.
##### Returns​
```
Map
```
<
```
string
```
,
```
ModeratorPermission
```
[]>
### nsfw​
#### Get Signature​
get nsfw():
```
boolean
```
Whether the user's profile is marked as NSFW (Not Safe For Work).
##### Returns​
```
boolean
```
### permalink​
#### Get Signature​
get permalink():
```
string
```
Returns a permalink path relative to https://www.reddit.com
##### Returns​
```
string
```
### url​
#### Get Signature​
get url():
```
string
```
Returns the HTTP URL for the user
##### Returns​
```
string
```
### username​
#### Get Signature​
get username():
```
string
```
The username of the user omitting the u/.
##### Example​
```
'spez'
```
##### Returns​
```
string
```
## Methods​
### getComments()​
getComments(
```
options
```
):
```
Listing
```
<
```
Comment
```
>
Get the user's comments.
#### Parameters​
##### options​
```
Omit
```
<
```
GetCommentsByUserOptions
```
,
```
"username"
```
>
Options for the request
#### Returns​
```
Listing
```
<
```
Comment
```
>
A Listing of Comment objects.
### getModPermissionsForSubreddit()​
getModPermissionsForSubreddit(
```
subredditName
```
):
```
Promise
```
<
```
ModeratorPermission
```
[]>
Get the mod permissions the user has on the subreddit if they are a moderator.
#### Parameters​
##### subredditName​
```
string
```
name of the subreddit
#### Returns​
```
Promise
```
<
```
ModeratorPermission
```
[]>
the moderator permissions the user has on the subreddit
### getPosts()​
getPosts(
```
options
```
):
```
Listing
```
<
```
Post
```
>
Get the user's posts.
#### Parameters​
##### options​
```
Omit
```
<
```
GetPostsByUserOptions
```
,
```
"username"
```
>
Options for the request
#### Returns​
```
Listing
```
<
```
Post
```
>
A Listing of Post objects.
### getSnoovatarUrl()​
getSnoovatarUrl():
```
Promise
```
<
```
undefined
```
|
```
string
```
>
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
string
```
>
### getSocialLinks()​
getSocialLinks():
```
Promise
```
<
```
UserSocialLink
```
[]>
Gets social links of the user
#### Returns​
```
Promise
```
<
```
UserSocialLink
```
[]>
A Promise that resolves an Array of UserSocialLink objects
#### Example​
```
const socialLinks = await user.getSocialLinks();
```
### getTrophies()​
getTrophies():
```
Promise
```
<
```
Trophy
```
[]>
Get the trophies displayed on this user's profile.
#### Returns​
```
Promise
```
<
```
Trophy
```
[]>
A Promise that resolves to an array of Trophy objects.
### getUserFlairBySubreddit()​
getUserFlairBySubreddit(
```
subreddit
```
):
```
Promise
```
<
```
undefined
```
|
```
UserFlair
```
>
Retrieve the user's flair for the subreddit.
#### Parameters​
##### subreddit​
```
string
```
The name of the subreddit associated with the user's flair.
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
UserFlair
```
>
#### Example​
```
const username = "badapple"const subredditName = "mysubreddit"const user = await reddit.getUserByUsername(username);const userFlair = await user.getUserFlairBySubreddit(subredditName);
```
### getUserKarmaFromCurrentSubreddit()​
getUserKarmaFromCurrentSubreddit():
```
Promise
```
<
```
GetUserKarmaForSubredditResponse
```
>
Returns the karma for this User in the current subreddit.
The user making the request must be a moderator of the subreddit to read another user's karma in the subreddit.
An exception is if the specified user is the same as the user making the request.
#### Returns​
```
Promise
```
<
```
GetUserKarmaForSubredditResponse
```
>
The GetUserKarmaForSubredditResponse, containing the user's karma for comments and posts in the subreddit.
### toJSON()​
toJSON():
```
Pick
```
<
```
User
```
,
```
"username"
```
|
```
"id"
```
|
```
"createdAt"
```
|
```
"nsfw"
```
|
```
"linkKarma"
```
|
```
"commentKarma"
```
> &
```
object
```
#### Returns​
```
Pick
```
<
```
User
```
,
```
"username"
```
|
```
"id"
```
|
```
"createdAt"
```
|
```
"nsfw"
```
|
```
"linkKarma"
```
|
```
"commentKarma"
```
> &
```
object
```
Previous
TextAreaWidget
Next
Widget
Accessors
about
commentKarma
createdAt
displayName
hasVerifiedEmail
id
isAdmin
linkKarma
modPermissions
nsfw
permalink
url
username
Methods
getComments()
getModPermissionsForSubreddit()
getPosts()
getSnoovatarUrl()
getSocialLinks()
getTrophies()
getUserFlairBySubreddit()
getUserKarmaFromCurrentSubreddit()
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.23 Widget

Widget | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
Widget
On this page
# Widget
@devvit/public-api v0.12.20-dev
# Class: Widget
## Extended by​
```
ImageWidget
```
```
CalendarWidget
```
```
TextAreaWidget
```
```
ButtonWidget
```
```
CommunityListWidget
```
```
PostFlairWidget
```
```
CustomWidget
```
```
SubredditRulesWidget
```
## Constructors​
### new Widget()​
new Widget(
```
widgetData
```
,
```
subredditName
```
,
```
metadata
```
):
```
Widget
```
#### Parameters​
##### widgetData​
```
GetWidgetsResponse_WidgetItem
```
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
Widget
```
## Accessors​
### id​
#### Get Signature​
get id():
```
string
```
##### Returns​
```
string
```
### name​
#### Get Signature​
get name():
```
string
```
##### Returns​
```
string
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### toJSON()​
toJSON():
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
>
#### Returns​
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
>
Previous
User
Next
WikiPage
Extended by
Constructors
new Widget()
Accessors
id
name
subredditName
Methods
delete()
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.24 WikiPage

WikiPage | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
WikiPage
On this page
# WikiPage
@devvit/public-api v0.12.20-dev
# Class: WikiPage
## Accessors​
### content​
#### Get Signature​
get content():
```
string
```
The Markdown content of the page.
##### Returns​
```
string
```
### contentHtml​
#### Get Signature​
get contentHtml():
```
string
```
The HTML content of the page.
##### Returns​
```
string
```
### name​
#### Get Signature​
get name():
```
string
```
The name of the page.
##### Returns​
```
string
```
### revisionAuthor​
#### Get Signature​
get revisionAuthor():
```
undefined
```
|
```
User
```
The author of this revision.
##### Returns​
```
undefined
```
|
```
User
```
### revisionDate​
#### Get Signature​
get revisionDate():
```
Date
```
The date of the revision.
##### Returns​
```
Date
```
### revisionId​
#### Get Signature​
get revisionId():
```
`${string}-${string}-${string}-${string}-${string}`
```
The ID of the revision.
##### Returns​
```
`${string}-${string}-${string}-${string}-${string}`
```
### revisionReason​
#### Get Signature​
get revisionReason():
```
string
```
The reason for the revision.
##### Returns​
```
string
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
The name of the subreddit the page is in.
##### Returns​
```
string
```
## Methods​
### addEditor()​
addEditor(
```
username
```
):
```
Promise
```
<
```
void
```
>
Add an editor to this page.
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### getRevisions()​
getRevisions(
```
options
```
):
```
Promise
```
<
```
Listing
```
<
```
WikiPageRevision
```
>>
Get the revisions for this page.
#### Parameters​
##### options​
```
Omit
```
<
```
GetPageRevisionsOptions
```
,
```
"subredditName"
```
|
```
"page"
```
>
#### Returns​
```
Promise
```
<
```
Listing
```
<
```
WikiPageRevision
```
>>
### getSettings()​
getSettings():
```
Promise
```
<
```
WikiPageSettings
```
>
Get the settings for this page.
#### Returns​
```
Promise
```
<
```
WikiPageSettings
```
>
### removeEditor()​
removeEditor(
```
username
```
):
```
Promise
```
<
```
void
```
>
Remove an editor from this page.
#### Parameters​
##### username​
```
string
```
#### Returns​
```
Promise
```
<
```
void
```
>
### revertTo()​
revertTo(
```
revisionId
```
):
```
Promise
```
<
```
void
```
>
Revert this page to a previous revision.
#### Parameters​
##### revisionId​
```
`${string}-${string}-${string}-${string}-${string}`
```
#### Returns​
```
Promise
```
<
```
void
```
>
### toJSON()​
toJSON():
```
Pick
```
<
```
WikiPage
```
,
```
"subredditName"
```
|
```
"name"
```
|
```
"content"
```
|
```
"contentHtml"
```
|
```
"revisionId"
```
|
```
"revisionDate"
```
|
```
"revisionReason"
```
> &
```
object
```
#### Returns​
```
Pick
```
<
```
WikiPage
```
,
```
"subredditName"
```
|
```
"name"
```
|
```
"content"
```
|
```
"contentHtml"
```
|
```
"revisionId"
```
|
```
"revisionDate"
```
|
```
"revisionReason"
```
> &
```
object
```
### update()​
update(
```
content
```
,
```
reason
```
?):
```
Promise
```
<
```
WikiPage
```
>
Update this page.
#### Parameters​
##### content​
```
string
```
##### reason?​
```
string
```
#### Returns​
```
Promise
```
<
```
WikiPage
```
>
### updateSettings()​
updateSettings(
```
options
```
):
```
Promise
```
<
```
WikiPageSettings
```
>
Update the settings for this page.
#### Parameters​
##### options​
```
Omit
```
<
```
UpdatePageSettingsOptions
```
,
```
"subredditName"
```
|
```
"page"
```
>
#### Returns​
```
Promise
```
<
```
WikiPageSettings
```
>
Previous
Widget
Next
WikiPageRevision
Accessors
content
contentHtml
name
revisionAuthor
revisionDate
revisionId
revisionReason
subredditName
Methods
addEditor()
getRevisions()
getSettings()
removeEditor()
revertTo()
toJSON()
update()
updateSettings()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.25 WikiPageRevision

WikiPageRevision | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
WikiPageRevision
On this page
# WikiPageRevision
@devvit/public-api v0.12.20-dev
# Class: WikiPageRevision
## Constructors​
### new WikiPageRevision()​
new WikiPageRevision(
```
data
```
,
```
metadata
```
):
```
WikiPageRevision
```
#### Parameters​
##### data​
```
WikiPageRevision
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
WikiPageRevision
```
## Accessors​
### author​
#### Get Signature​
get author():
```
User
```
##### Returns​
```
User
```
### date​
#### Get Signature​
get date():
```
Date
```
##### Returns​
```
Date
```
### hidden​
#### Get Signature​
get hidden():
```
boolean
```
##### Returns​
```
boolean
```
### id​
#### Get Signature​
get id():
```
`${string}-${string}-${string}-${string}-${string}`
```
##### Returns​
```
`${string}-${string}-${string}-${string}-${string}`
```
### page​
#### Get Signature​
get page():
```
string
```
##### Returns​
```
string
```
### reason​
#### Get Signature​
get reason():
```
string
```
##### Returns​
```
string
```
## Methods​
### toJSON()​
toJSON():
```
Pick
```
<
```
WikiPageRevision
```
,
```
"id"
```
|
```
"hidden"
```
|
```
"reason"
```
|
```
"page"
```
|
```
"date"
```
> &
```
object
```
#### Returns​
```
Pick
```
<
```
WikiPageRevision
```
,
```
"id"
```
|
```
"hidden"
```
|
```
"reason"
```
|
```
"page"
```
|
```
"date"
```
> &
```
object
```
Previous
WikiPage
Next
WikiPageSettings
Constructors
new WikiPageRevision()
Accessors
author
date
hidden
id
page
reason
Methods
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.26 WikiPageSettings

WikiPageSettings | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
WikiPageSettings
On this page
# WikiPageSettings
@devvit/public-api v0.12.20-dev
# Class: WikiPageSettings
## Constructors​
### new WikiPageSettings()​
new WikiPageSettings(
```
data
```
,
```
metadata
```
):
```
WikiPageSettings
```
#### Parameters​
##### data​
```
WikiPageSettings_Data
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
WikiPageSettings
```
## Accessors​
### editors​
#### Get Signature​
get editors():
```
User
```
[]
##### Returns​
```
User
```
[]
### listed​
#### Get Signature​
get listed():
```
boolean
```
##### Returns​
```
boolean
```
### permLevel​
#### Get Signature​
get permLevel():
```
WikiPagePermissionLevel
```
##### Returns​
```
WikiPagePermissionLevel
```
## Methods​
### toJSON()​
toJSON():
```
Pick
```
<
```
WikiPageSettings
```
,
```
"listed"
```
|
```
"permLevel"
```
> &
```
object
```
#### Returns​
```
Pick
```
<
```
WikiPageSettings
```
,
```
"listed"
```
|
```
"permLevel"
```
> &
```
object
```
Previous
WikiPageRevision
Next
ModAction
Constructors
new WikiPageSettings()
Accessors
editors
listed
permLevel
Methods
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.3 CalendarWidget

CalendarWidget | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
CalendarWidget
On this page
# CalendarWidget
@devvit/public-api v0.12.20-dev
# Class: CalendarWidget
## Extends​
```
Widget
```
## Constructors​
### new CalendarWidget()​
new CalendarWidget(
```
widgetData
```
,
```
subredditName
```
,
```
metadata
```
):
```
CalendarWidget
```
#### Parameters​
##### widgetData​
```
GetWidgetsResponse_WidgetItem
```
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
CalendarWidget
```
#### Overrides​
```
Widget
```
.
```
constructor
```
## Accessors​
### configuration​
#### Get Signature​
get configuration():
```
CalendarWidgetConfiguration
```
##### Returns​
```
CalendarWidgetConfiguration
```
### googleCalendarId​
#### Get Signature​
get googleCalendarId():
```
string
```
##### Returns​
```
string
```
### id​
#### Get Signature​
get id():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
id
```
### name​
#### Get Signature​
get name():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
name
```
### styles​
#### Get Signature​
get styles():
```
WidgetStyles
```
##### Returns​
```
WidgetStyles
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
subredditName
```
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
#### Inherited from​
```
Widget
```
.
```
delete
```
### toJSON()​
toJSON():
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
CalendarWidget
```
,
```
"googleCalendarId"
```
|
```
"configuration"
```
|
```
"styles"
```
>
#### Returns​
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
CalendarWidget
```
,
```
"googleCalendarId"
```
|
```
"configuration"
```
|
```
"styles"
```
>
#### Overrides​
```
Widget
```
.
```
toJSON
```
Previous
ButtonWidget
Next
Comment
Extends
Constructors
new CalendarWidget()
Accessors
configuration
googleCalendarId
id
name
styles
subredditName
Methods
delete()
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.4 Comment

Comment | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
Comment
On this page
# Comment
@devvit/public-api v0.12.20-dev
# Class: Comment
## Accessors​
### approved​
#### Get Signature​
get approved():
```
boolean
```
##### Returns​
```
boolean
```
### approvedAtUtc​
#### Get Signature​
get approvedAtUtc():
```
number
```
A number representing the UTC timestamp in seconds, or 0 if its not approved.
##### Returns​
```
number
```
### authorFlair​
#### Get Signature​
get authorFlair():
```
undefined
```
|
```
CommonFlair
```
##### Returns​
```
undefined
```
|
```
CommonFlair
```
### authorId​
#### Get Signature​
get authorId():
```
undefined
```
|
```
`t2_${string}`
```
##### Returns​
```
undefined
```
|
```
`t2_${string}`
```
### authorName​
#### Get Signature​
get authorName():
```
string
```
##### Returns​
```
string
```
### bannedAtUtc​
#### Get Signature​
get bannedAtUtc():
```
number
```
##### Returns​
```
number
```
### body​
#### Get Signature​
get body():
```
string
```
##### Returns​
```
string
```
### collapsedBecauseCrowdControl​
#### Get Signature​
get collapsedBecauseCrowdControl():
```
boolean
```
##### Returns​
```
boolean
```
### createdAt​
#### Get Signature​
get createdAt():
```
Date
```
##### Returns​
```
Date
```
### distinguishedBy​
#### Get Signature​
get distinguishedBy():
```
undefined
```
|
```
string
```
##### Returns​
```
undefined
```
|
```
string
```
### edited​
#### Get Signature​
get edited():
```
boolean
```
##### Returns​
```
boolean
```
### id​
#### Get Signature​
get id():
```
`t1_${string}`
```
##### Returns​
```
`t1_${string}`
```
### ignoringReports​
#### Get Signature​
get ignoringReports():
```
boolean
```
##### Returns​
```
boolean
```
### locked​
#### Get Signature​
get locked():
```
boolean
```
##### Returns​
```
boolean
```
### modReportReasons​
#### Get Signature​
get modReportReasons():
```
string
```
[]
##### Returns​
```
string
```
[]
### numReports​
#### Get Signature​
get numReports():
```
number
```
##### Returns​
```
number
```
### parentId​
#### Get Signature​
get parentId():
```
`t1_${string}`
```
|
```
`t3_${string}`
```
##### Returns​
```
`t1_${string}`
```
|
```
`t3_${string}`
```
### permalink​
#### Get Signature​
get permalink():
```
string
```
##### Returns​
```
string
```
### postId​
#### Get Signature​
get postId():
```
`t3_${string}`
```
##### Returns​
```
`t3_${string}`
```
### removed​
#### Get Signature​
get removed():
```
boolean
```
##### Returns​
```
boolean
```
### replies​
#### Get Signature​
get replies():
```
Listing
```
<
```
Comment
```
>
##### Returns​
```
Listing
```
<
```
Comment
```
>
### score​
#### Get Signature​
get score():
```
number
```
##### Returns​
```
number
```
### spam​
#### Get Signature​
get spam():
```
boolean
```
##### Returns​
```
boolean
```
### stickied​
#### Get Signature​
get stickied():
```
boolean
```
##### Returns​
```
boolean
```
### subredditId​
#### Get Signature​
get subredditId():
```
`t5_${string}`
```
##### Returns​
```
`t5_${string}`
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
### url​
#### Get Signature​
get url():
```
string
```
##### Returns​
```
string
```
### userReportReasons​
#### Get Signature​
get userReportReasons():
```
string
```
[]
##### Returns​
```
string
```
[]
## Methods​
### addRemovalNote()​
addRemovalNote(
```
options
```
):
```
Promise
```
<
```
void
```
>
Add a mod note for why the comment was removed
#### Parameters​
##### options​
###### modNote?​
```
string
```
the reason for removal (maximum 100 characters) (optional)
###### reasonId​
```
string
```
id of a Removal Reason - you can leave this as an empty string if you don't have one
#### Returns​
```
Promise
```
<
```
void
```
>
### approve()​
approve():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### distinguish()​
distinguish(
```
makeSticky
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### makeSticky​
```
boolean
```
=
```
false
```
#### Returns​
```
Promise
```
<
```
void
```
>
### distinguishAsAdmin()​
distinguishAsAdmin(
```
makeSticky
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### makeSticky​
```
boolean
```
=
```
false
```
#### Returns​
```
Promise
```
<
```
void
```
>
### edit()​
edit(
```
options
```
):
```
Promise
```
<
```
Comment
```
>
#### Parameters​
##### options​
```
CommentSubmissionOptions
```
#### Returns​
```
Promise
```
<
```
Comment
```
>
### getAuthor()​
getAuthor():
```
Promise
```
<
```
undefined
```
|
```
User
```
>
#### Returns​
```
Promise
```
<
```
undefined
```
|
```
User
```
>
### ignoreReports()​
ignoreReports():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### isApproved()​
isApproved():
```
boolean
```
#### Returns​
```
boolean
```
### isDistinguished()​
isDistinguished():
```
boolean
```
#### Returns​
```
boolean
```
### isEdited()​
isEdited():
```
boolean
```
#### Returns​
```
boolean
```
### isIgnoringReports()​
isIgnoringReports():
```
boolean
```
#### Returns​
```
boolean
```
### isLocked()​
isLocked():
```
boolean
```
#### Returns​
```
boolean
```
### isRemoved()​
isRemoved():
```
boolean
```
#### Returns​
```
boolean
```
### isSpam()​
isSpam():
```
boolean
```
#### Returns​
```
boolean
```
### isStickied()​
isStickied():
```
boolean
```
#### Returns​
```
boolean
```
### lock()​
lock():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### remove()​
remove(
```
isSpam
```
):
```
Promise
```
<
```
void
```
>
#### Parameters​
##### isSpam​
```
boolean
```
=
```
false
```
#### Returns​
```
Promise
```
<
```
void
```
>
### reply()​
reply(
```
options
```
):
```
Promise
```
<
```
Comment
```
>
#### Parameters​
##### options​
```
CommentSubmissionOptions
```
#### Returns​
```
Promise
```
<
```
Comment
```
>
### showComment()​
showComment():
```
Promise
```
<
```
void
```
>
Marks that this comment should not be collapsed by the crowd control system.
It can still be collapsed for other reasons.
#### Returns​
```
Promise
```
<
```
void
```
>
### snoozeReports()​
snoozeReports(
```
reason
```
):
```
Promise
```
<
```
void
```
>
Snooze subsequent reports with the given reason from the same users for the next 7 days.
Only works for free-form reports.
#### Parameters​
##### reason​
```
string
```
The report reason to snooze.
#### Returns​
```
Promise
```
<
```
void
```
>
### toJSON()​
toJSON():
```
Pick
```
<
```
Comment
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"score"
```
|
```
"subredditId"
```
|
```
"postId"
```
|
```
"url"
```
|
```
"createdAt"
```
|
```
"permalink"
```
|
```
"authorName"
```
|
```
"body"
```
|
```
"approved"
```
|
```
"spam"
```
|
```
"stickied"
```
|
```
"removed"
```
|
```
"edited"
```
|
```
"locked"
```
|
```
"ignoringReports"
```
|
```
"distinguishedBy"
```
|
```
"authorFlair"
```
|
```
"userReportReasons"
```
|
```
"modReportReasons"
```
|
```
"parentId"
```
|
```
"replies"
```
|
```
"numReports"
```
|
```
"collapsedBecauseCrowdControl"
```
>
#### Returns​
```
Pick
```
<
```
Comment
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"score"
```
|
```
"subredditId"
```
|
```
"postId"
```
|
```
"url"
```
|
```
"createdAt"
```
|
```
"permalink"
```
|
```
"authorName"
```
|
```
"body"
```
|
```
"approved"
```
|
```
"spam"
```
|
```
"stickied"
```
|
```
"removed"
```
|
```
"edited"
```
|
```
"locked"
```
|
```
"ignoringReports"
```
|
```
"distinguishedBy"
```
|
```
"authorFlair"
```
|
```
"userReportReasons"
```
|
```
"modReportReasons"
```
|
```
"parentId"
```
|
```
"replies"
```
|
```
"numReports"
```
|
```
"collapsedBecauseCrowdControl"
```
>
### undistinguish()​
undistinguish():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### unignoreReports()​
unignoreReports():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### unlock()​
unlock():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
### unsnoozeReports()​
unsnoozeReports(
```
reason
```
):
```
Promise
```
<
```
void
```
>
Unsnooze reports with the given reason.
Only works for free-form reports.
#### Parameters​
##### reason​
```
string
```
The report reason to unsnooze.
#### Returns​
```
Promise
```
<
```
void
```
>
Previous
CalendarWidget
Next
CommunityListWidget
Accessors
approved
approvedAtUtc
authorFlair
authorId
authorName
bannedAtUtc
body
collapsedBecauseCrowdControl
createdAt
distinguishedBy
edited
id
ignoringReports
locked
modReportReasons
numReports
parentId
permalink
postId
removed
replies
score
spam
stickied
subredditId
subredditName
url
userReportReasons
Methods
addRemovalNote()
approve()
delete()
distinguish()
distinguishAsAdmin()
edit()
getAuthor()
ignoreReports()
isApproved()
isDistinguished()
isEdited()
isIgnoringReports()
isLocked()
isRemoved()
isSpam()
isStickied()
lock()
remove()
reply()
showComment()
snoozeReports()
toJSON()
undistinguish()
unignoreReports()
unlock()
unsnoozeReports()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.5 CommunityListWidget

CommunityListWidget | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
CommunityListWidget
On this page
# CommunityListWidget
@devvit/public-api v0.12.20-dev
# Class: CommunityListWidget
## Extends​
```
Widget
```
## Constructors​
### new CommunityListWidget()​
new CommunityListWidget(
```
widgetData
```
,
```
subredditName
```
,
```
metadata
```
):
```
CommunityListWidget
```
#### Parameters​
##### widgetData​
```
GetWidgetsResponse_WidgetItem
```
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
CommunityListWidget
```
#### Overrides​
```
Widget
```
.
```
constructor
```
## Accessors​
### communities​
#### Get Signature​
get communities():
```
CommunityListWidget_CommunityData
```
[]
##### Returns​
```
CommunityListWidget_CommunityData
```
[]
### id​
#### Get Signature​
get id():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
id
```
### name​
#### Get Signature​
get name():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
name
```
### styles​
#### Get Signature​
get styles():
```
WidgetStyles
```
##### Returns​
```
WidgetStyles
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
subredditName
```
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
#### Inherited from​
```
Widget
```
.
```
delete
```
### toJSON()​
toJSON():
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
CommunityListWidget
```
,
```
"communities"
```
|
```
"styles"
```
>
#### Returns​
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
CommunityListWidget
```
,
```
"communities"
```
|
```
"styles"
```
>
#### Overrides​
```
Widget
```
.
```
toJSON
```
Previous
Comment
Next
CustomWidget
Extends
Constructors
new CommunityListWidget()
Accessors
communities
id
name
styles
subredditName
Methods
delete()
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.5 CustomWidget

CustomWidget | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
CustomWidget
On this page
# CustomWidget
@devvit/public-api v0.12.20-dev
# Class: CustomWidget
## Extends​
```
Widget
```
## Constructors​
### new CustomWidget()​
new CustomWidget(
```
widgetData
```
,
```
subredditName
```
,
```
metadata
```
):
```
CustomWidget
```
#### Parameters​
##### widgetData​
```
GetWidgetsResponse_WidgetItem
```
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
CustomWidget
```
#### Overrides​
```
Widget
```
.
```
constructor
```
## Accessors​
### css​
#### Get Signature​
get css():
```
string
```
##### Returns​
```
string
```
### height​
#### Get Signature​
get height():
```
number
```
##### Returns​
```
number
```
### id​
#### Get Signature​
get id():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
id
```
### images​
#### Get Signature​
get images():
```
WidgetImage
```
[]
##### Returns​
```
WidgetImage
```
[]
### name​
#### Get Signature​
get name():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
name
```
### stylesheetUrl​
#### Get Signature​
get stylesheetUrl():
```
string
```
##### Returns​
```
string
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
subredditName
```
### text​
#### Get Signature​
get text():
```
string
```
##### Returns​
```
string
```
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
#### Inherited from​
```
Widget
```
.
```
delete
```
### toJSON()​
toJSON():
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
CustomWidget
```
,
```
"text"
```
|
```
"height"
```
|
```
"images"
```
|
```
"stylesheetUrl"
```
|
```
"css"
```
>
#### Returns​
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
CustomWidget
```
,
```
"text"
```
|
```
"height"
```
|
```
"images"
```
|
```
"stylesheetUrl"
```
|
```
"css"
```
>
#### Overrides​
```
Widget
```
.
```
toJSON
```
Previous
CommunityListWidget
Next
Flair
Extends
Constructors
new CustomWidget()
Accessors
css
height
id
images
name
stylesheetUrl
subredditName
text
Methods
delete()
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.6 Flair

Flair | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
Flair
On this page
# Flair
@devvit/public-api v0.12.20-dev
# Class: Flair
## Constructors​
### new Flair()​
new Flair():
```
Flair
```
#### Returns​
```
Flair
```
Previous
CustomWidget
Next
FlairTemplate
Constructors
new Flair()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.7 FlairTemplate

FlairTemplate | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
FlairTemplate
On this page
# FlairTemplate
@devvit/public-api v0.12.20-dev
# Class: FlairTemplate
## Accessors​
### allowableContent​
#### Get Signature​
get allowableContent():
```
AllowableFlairContent
```
The flair template's allowable content. Either 'all', 'emoji', or 'text'.
##### Returns​
```
AllowableFlairContent
```
### allowUserEdits​
#### Get Signature​
get allowUserEdits():
```
boolean
```
Does the flair template allow users to edit their flair?
##### Returns​
```
boolean
```
### backgroundColor​
#### Get Signature​
get backgroundColor():
```
FlairBackgroundColor
```
The flair template's background color. Either 'transparent' or a hex color code. e.g. #FFC0CB
##### Returns​
```
FlairBackgroundColor
```
### id​
#### Get Signature​
get id():
```
string
```
The flair template's ID
##### Returns​
```
string
```
### maxEmojis​
#### Get Signature​
get maxEmojis():
```
number
```
The flair template's maximum number of emojis.
##### Returns​
```
number
```
### modOnly​
#### Get Signature​
get modOnly():
```
boolean
```
Is the flair template only available to moderators?
##### Returns​
```
boolean
```
### text​
#### Get Signature​
get text():
```
string
```
The flair template's text
##### Returns​
```
string
```
### textColor​
#### Get Signature​
get textColor():
```
FlairTextColor
```
The flair template's text color. Either 'dark' or 'light'.
##### Returns​
```
FlairTextColor
```
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
Delete this flair template
#### Returns​
```
Promise
```
<
```
void
```
>
### edit()​
edit(
```
options
```
):
```
Promise
```
<
```
FlairTemplate
```
>
Edit this flair template
#### Parameters​
##### options​
```
Partial
```
<
```
Omit
```
<
```
EditFlairTemplateOptions
```
,
```
"subredditName"
```
|
```
"id"
```
>>
#### Returns​
```
Promise
```
<
```
FlairTemplate
```
>
Previous
Flair
Next
ImageWidget
Accessors
allowableContent
allowUserEdits
backgroundColor
id
maxEmojis
modOnly
text
textColor
Methods
delete()
edit()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.8 ImageWidget

ImageWidget | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
ImageWidget
On this page
# ImageWidget
@devvit/public-api v0.12.20-dev
# Class: ImageWidget
## Extends​
```
Widget
```
## Constructors​
### new ImageWidget()​
new ImageWidget(
```
widgetData
```
,
```
subredditName
```
,
```
metadata
```
):
```
ImageWidget
```
#### Parameters​
##### widgetData​
```
GetWidgetsResponse_WidgetItem
```
##### subredditName​
```
string
```
##### metadata​
```
undefined
```
|
```
Metadata
```
#### Returns​
```
ImageWidget
```
#### Overrides​
```
Widget
```
.
```
constructor
```
## Accessors​
### id​
#### Get Signature​
get id():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
id
```
### images​
#### Get Signature​
get images():
```
WidgetImage
```
[]
##### Returns​
```
WidgetImage
```
[]
### name​
#### Get Signature​
get name():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
name
```
### subredditName​
#### Get Signature​
get subredditName():
```
string
```
##### Returns​
```
string
```
#### Inherited from​
```
Widget
```
.
```
subredditName
```
## Methods​
### delete()​
delete():
```
Promise
```
<
```
void
```
>
#### Returns​
```
Promise
```
<
```
void
```
>
#### Inherited from​
```
Widget
```
.
```
delete
```
### toJSON()​
toJSON():
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
ImageWidget
```
,
```
"images"
```
>
#### Returns​
```
Pick
```
<
```
Widget
```
,
```
"subredditName"
```
|
```
"id"
```
|
```
"name"
```
> &
```
Pick
```
<
```
ImageWidget
```
,
```
"images"
```
>
#### Overrides​
```
Widget
```
.
```
toJSON
```
Previous
FlairTemplate
Next
Listing
Extends
Constructors
new ImageWidget()
Accessors
id
images
name
subredditName
Methods
delete()
toJSON()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.3.9 Listing

Listing | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Classes
Listing
On this page
# Listing
@devvit/public-api v0.12.20-dev
# Class: Listing<T>
## Type Parameters​
### T​
```
T
```
## Properties​
### limit​
limit:
```
number
```
=
```
DEFAULT_LIMIT
```
### pageSize​
pageSize:
```
number
```
=
```
DEFAULT_PAGE_SIZE
```
## Accessors​
### hasMore​
#### Get Signature​
get hasMore():
```
boolean
```
##### Returns​
```
boolean
```
## Methods​
### [asyncIterator]()​
[asyncIterator]():
```
AsyncIterator
```
<
```
T
```
>
#### Returns​
```
AsyncIterator
```
<
```
T
```
>
### all()​
all():
```
Promise
```
<
```
T
```
[]>
#### Returns​
```
Promise
```
<
```
T
```
[]>
### get()​
get(
```
count
```
):
```
Promise
```
<
```
T
```
[]>
#### Parameters​
##### count​
```
number
```
#### Returns​
```
Promise
```
<
```
T
```
[]>
### preventInitialFetch()​
preventInitialFetch():
```
void
```
#### Returns​
```
void
```
### setMore()​
setMore(
```
more
```
):
```
void
```
#### Parameters​
##### more​
```
undefined
```
|
```
MoreObject
```
#### Returns​
```
void
```
Previous
ImageWidget
Next
ModMailService
Type Parameters
T
Properties
limit
pageSize
Accessors
hasMore
Methods
[asyncIterator]()
all()
get()
preventInitialFetch()
setMore()
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 7.4 ModAction

ModAction | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
ModAction
Saving Data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Reddit API
Interfaces
ModAction
On this page
# ModAction
@devvit/public-api v0.12.20-dev
# Interface: ModAction
## Properties​
### createdAt​
createdAt:
```
Date
```
When the action took place.
### description?​
```
optional
```
description:
```
string
```
The string "Page modmail-stats edited: Daily update of the
modmail-stats (Wed Jul 02 2025 08:05:47 UTC+0200 (Europe/Amsterdam))" is
made up of
```
description
```
and
```
details
```
. The "Page modmail-stats edited" is
the "description".
### details?​
```
optional
```
details:
```
string
```
The string "Page modmail-stats edited: Daily update of the
modmail-stats (Wed Jul 02 2025 08:05:47 UTC+0200 (Europe/Amsterdam))" is
made up of
```
description
```
and
```
details
```
. The "Daily update of the
modmail-stats (Wed Jul 02 2025 08:05:47 UTC+0200 (Europe/Amsterdam))" is
the "details".
### id​
id:
```
string
```
A string like
```
"ModAction_1b1af634-5b87-11f0-a4f1-4ddd27626cc4"
```
identifying the ModAction.
### moderatorId​
moderatorId:
```
string
```
The t2_ id of the moderator.
### moderatorName​
moderatorName:
```
string
```
The username of the moderator.
### subredditId​
subredditId:
```
string
```
The ID of the subreddit the action took place.
### subredditName​
subredditName:
```
string
```
The name of the subreddit the action took place.
### target?​
```
optional
```
target:
```
ModActionTarget
```
Some context of the affected item of the modaction.
### type​
type:
```
ModActionType
```
The type of the action. Think of what happened.
Previous
WikiPageSettings
Next
Redis
Properties
createdAt
description?
details?
id
moderatorId
moderatorName
subredditId
subredditName
target?
type
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 8.1 Redis

Redis | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
ModAction
Saving Data
Redis
Cache helper
Post data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Saving Data
Redis
On this page
# Redis
You can add a database to your app to store and retrieve data. The Redis plugin is designed to be fast, scalable, and secure. It supports a subset of the full Redis API, including:
Transactions for things like counting votes atomically in polls
String operations for persisting information
Number operations for incrementing numbers
Sorted sets for creating leaderboards
Hashes for managing a collection of key-value pairs
Bitfields for efficient operation on sequences of bits
Each installation of an app is uniquely name-spaced, which means Redis data is siloed by subreddit. Keep in mind that there won’t be a single source of truth for all installations of your app, since each app installation can only access the data that it has stored in the Redis database.
## Limits and quotas​
Max commands per second: 40000
Max request size: 5 MB
Max storage: 500 MB
Pipelining is not supported
Sets - only sorted sets are supported
No support for listing keys
No support for lua scripts to execute custom logic on redis server
All limits are applied at a per-installation granularity.
## Examples​
### Menu actions​
devvit.json
```
{ "menuActions": [ { "label": "Redis Test", "endpoint": "/internal/menu/redis-test", "forUserType": "moderator", "location": "subreddit" } ] }
```
Hono
Express
server/index.ts
```
import { redis } from '@devvit/redis';import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';app.post('/internal/menu/redis-test', async (c) => { const _request = await c.req.json<MenuItemRequest>(); const key = 'hello'; await redis.set(key, 'world'); const value = await redis.get(key); console.log(`${key}: ${value}`); return c.json<UiResponse>({ status: 'ok' });});
```
### Games​
You can take a look at this Game Template to see a basic implementation of Redis in a game built with Phaser.JS
## Supported Redis commands​
note
Not all Redis features are supported. If you would like to request a specific Redis feature, please reach out to our team via modmail or Discord.
For all examples below, we assume that you already have obtained a Redis Client. Here's how to obtain a Redis Client:
devvit.json
```
{ "permissions": { "redis": true } }
```
server/index.ts
```
import { redis } from '@devvit/redis';
```
### Simple read/write​
Command
Action
Limits
get
Gets the value of key.
None
set
Sets key to hold a string value.
Subject to storage quota gating (writes may be blocked if quota exceeded)
exists
Returns number of given keys that exist.
None
del
Removes the specified keys.
None
type
Returns the string representation of the type of value stored at key.
None
rename
Renames a key.
None
Code Example
```
async function simpleReadWriteExample() { // Set a key await redis.set('color', 'red'); // Check if a key exists console.log('Key exists: ' + (await redis.exists('color'))); // Get a key console.log('Color: ' + (await redis.get('color'))); // Get the type of a key console.log('Type: ' + (await redis.type('color'))); // Delete a key await redis.del('color');}
```
```
Color: redType: string
```
### Batch read/write​
Command
Action
Limits
mGet
Returns the values of all specified keys.
None
mSet
Sets the given keys to their respective values.
Subject to storage quota gating (writes may be blocked if quota exceeded)
Code Example
```
async function batchReadWriteExample() { // Set multiple keys at once await redis.mSet({ name: 'Devvit', occupation: 'Developer', yearsOfExperience: '9000', }); // Get multiple keys console.log('Result: ' + (await redis.mGet(['name', 'occupation'])));}
```
```
Result: Devvit,Developer
```
### Strings​
Command
Action
Limits
getRange
Returns the substring of the string value stored at key, determined by the offsets start and end (both are inclusive).
None
setRange
Overwrites part of the string stored at key, starting at the specified offset, for the entire length of value.
Subject to storage quota gating (writes may be blocked if quota exceeded)
strLen
Returns the length of the string value stored at key.
None
Code Example
```
async function stringsExample() { // First, set 'word' to 'tacocat' await redis.set('word', 'tacocat'); // Use getRange() to get the letters in 'word' between index 0 to 3, inclusive console.log('Range from index 0 to 3: ' + (await redis.getRange('word', 0, 3))); // Use setRange() to insert 'blue' at index 0 await redis.setRange('word', 0, 'blue'); console.log('Word after using setRange(): ' + (await redis.get('word'))); // Use strLen() to verify the word length console.log('Word length: ' + (await redis.strLen('word')));}
```
```
Range from index 0 to 3: tacoWord after using setRange(): bluecatWord length: 7
```
### Hash​
Redis hashes can store up to ~ 4.2 billion key-value pairs. We recommend using hash for managing collections of key-value pairs whenever possible and iterating over it using a combination of
```
hscan
```
,
```
hkeys
```
and
```
hgetall
```
.
Command
Action
Limits
hGet
Returns the value associated with field in the hash stored at key.
None
hMGet
Returns the value of all specified field in the hash stored at multiple keys.
May be disabled for your app (allowlisted feature)
hSet
Sets the specified fields to their respective values in the hash stored at key.
Subject to storage quota gating (writes may be blocked if quota exceeded)
hSetNX
Sets field in the hash stored at key to value, only if field does not yet exist.ƒ
Subject to storage quota gating (writes may be blocked if quota exceeded)
hDel
Removes the specified fields from the hash stored at key.
None
hGetAll
Returns a map of fields and their values stored in the hash.
None
hKeys
Returns all field names in the hash stored at key.
None
hScan
Iterates fields of Hash types and their associated values.
No server-side cap; uses requested count
hIncrBy
Increments the score of member in the sorted set stored at key by value.
Subject to storage quota gating (writes may be blocked if quota exceeded)
hLen
Returns the number of fields contained in the hash stored at key.
None
Code Examples
Example 1
```
// Example using hGet(), hSet(), and hDel()async function hashExample1() { // Set 'inventory' with multiple fields and values await redis.hSet('inventory', { sword: '1', potion: '4', shield: '2', stones: '8', }); // Get the value of 'shield' from 'inventory' console.log('Shield count: ' + await redis.hGet('inventory', 'shield')); // Get the values of both of 'shield' and 'potion' from 'inventory' console.log('Shield and potion count: ' + await redis.hMGet('inventory', ['shield', 'potion'])); // Delete some fields from 'inventory' console.log( 'Number of fields deleted: ' + await redis.hDel('inventory', ['sword', 'shield', 'stones']); );}
```
```
Shield count: 2Shield and potion count: 2,4Number of fields deleted: 3
```
Example 2
```
// Example using hGetAll()async function hashExample2() { // Set 'groceryList' to fields containing products with quantities await redis.hSet('groceryList', { eggs: '12', apples: '3', milk: '1', }); // Get the groceryList record const record = await redis.hGetAll('groceryList'); if (record != undefined) { console.log('Eggs: ' + record.eggs + ', Apples: ' + record.apples + ', Milk: ' + record.milk); }}
```
```
Eggs: 12, Apples: 3, Milk: 1
```
Example 3
```
// Example using hKeys()async function hashExample3() { await redis.hSet('prices', { chair: '48', desk: '95', whiteboard: '23', }); console.log('Keys: ' + (await redis.hKeys('prices')));}
```
```
Keys: chair,desk,whiteboard
```
Example 4
```
// Example using hScan()async function hashExample4() { await redis.hSet('userInfo', { name: 'Bob', startDate: '01-05-20', totalAwards: '12', }); // Scan and interate over all the fields within 'userInfo' const hScanResponse = await redis.hScan('userInfo', 0); hScanResponse.fieldValues.forEach((x) => { console.log("Field: '" + x.field + "', Value: '" + x.value + "'"); });}
```
```
Field: 'name', Value: 'Bob'Field: 'totalAwards', Value: '12'Field: 'startDate', Value: '01-05-20'
```
Example 5
```
// Example using hIncrBy()async function hashExample5() { // Set user123's karma to 100 await redis.hSet('user123', { karma: '100' }); // Increase user123's karma by 5 console.log('Updated karma: ' + (await redis.hIncrBy('user123', 'karma', 5)));}
```
```
Updated karma: 105
```
Example 6
```
// Example using hLen()async function hashExample6() { await redis.hSet('supplies', { paperclips: '25', pencils: '10', erasers: '5', pens: '7', }); console.log('Number of fields: ' + (await redis.hLen('supplies')));}
```
```
Number of fields: 4
```
### Numbers​
Command
Action
Limits
incrBy
Increments the number stored at key by increment.
Subject to storage quota gating (writes may be blocked if quota exceeded)
Code Example
```
async function numbersExample() { await redis.set('totalPoints', '53'); console.log('Updated points: ' + (await redis.incrBy('totalPoints', 100)));}
```
```
Updated points: 153
```
### Key expiration​
Command
Action
Limits
expire
Sets a timeout on key.
None
expireTime
Returns the remaining seconds at which the given key will expire.
None
Code Example
```
async function keyExpirationExample() { // Set a key 'product' with value 'milk' await redis.set('product', 'milk'); // Get the current expireTime for the product console.log('Expire time: ' + (await redis.expireTime('product'))); // Set the product to expire in 60 seconds await redis.expire('product', 60); // Get the updated expireTime for the product console.log('Updated expire time: ' + (await redis.expireTime('product')));}
```
```
Expire time: 0Updated expire time: 60
```
### Transactions​
Redis transactions allow a group of commands to be executed in a single isolated step. For example, to implement voting action in a polls app, these three actions need to happen together:
Store the selected option for the user.
Increment the count for selected option.
Add the user to voted user list.
The
```
watch
```
command provides an entrypoint for transactions. It returns a TxClientLike which can be used to call
```
multi
```
,
```
exec
```
,
```
discard
```
,
```
unwatch
```
, and all other Redis commands to be executed within a transaction.
You can sequence all of the above steps in a single transaction using
```
multi
```
and
```
exec
```
to ensure that either all of the steps happen together or none at all.
If an error occurs inside a transaction before
```
exec
```
is called, Redis discards the transaction automatically. See the Redis docs: Errors inside a transaction for more info.
Command
Action
Limits
multi
Marks the start of a transaction block.
Max concurrent transactions per installation: 20 (default)
exec
Executes all previously queued commands in a transaction and restores the connection state to normal.
Transaction execution timeout: 5 seconds
discard
Flushes all previously queued commands in a transaction and restores the connection state to normal.
None
watch
Marks the given keys to be watched for conditional execution of a transaction.
```
watch
```
returns a TxClientLike which should be used to call Redis commands in a transaction.
None
unwatch
Flushes all the previously watched keys for a transaction.
None
Code Examples
Example 1
```
// Example using exec()async function transactionsExample1() { await redis.mSet({ quantity: '5', karma: '32' }); const txn = await redis.watch('quantity'); await txn.multi(); // Begin a transaction await txn.incrBy('karma', 10); await txn.set('name', 'Devvit'); await txn.exec(); // Execute the commands in the transaction console.log( 'Keys after completing transaction: ' + (await redis.mGet(['quantity', 'karma', 'name'])) );}
```
```
Keys after completing transaction: 5,42,Devvit
```
Example 2
```
// Example using discard()async function transactionsExample2() { await redis.set('price', '25'); const txn = await redis.watch('price'); await txn.multi(); // Begin a transaction await txn.incrBy('price', 5); await txn.discard(); // Discard the commands in the transaction console.log('Price value: ' + (await redis.get('price'))); // 'price' should still be '25'}
```
```
Price value: 25
```
Example 3
```
// Example using unwatch()async function transactionsExample3() { await redis.set('gold', '50'); const txn = await redis.watch('gold'); await txn.multi(); // Begin a transaction await txn.incrBy('gold', 30); await txn.unwatch(); // Unwatch "gold" // Now that "gold" has been unwatched, we can increment its value // outside the transaction without canceling the transaction await redis.incrBy('gold', -20); await txn.exec(); // Execute the commands in the transaction console.log('Gold value: ' + (await redis.get('gold'))); // The value of 'gold' should be 50 + 30 - 20 = 60}
```
```
Gold value: 60
```
### Sorted set​
Command
Action
Limits
zAdd
Adds all the specified members with the specified scores to the sorted set stored at key.
Subject to storage quota gating (writes may be blocked if quota exceeded)
zCard
Returns the sorted set cardinality (number of elements) of the sorted set stored at key.
None
zRange
Returns the specified range of elements in the sorted set stored at key.
When using
```
by: 'lex'
```
, the start and stop inputs will be prepended with
```
[
```
by default, unless they already begin with
```
[
```
,
```
(
```
or are one of the special values
```
+
```
or
```
-
```
.
BYSCORE/BYLEX: LIMIT count capped to 1000 per call (server default). RANK: no server cap. Client default for by: 'score'/'lex' is count=1000 when no limit is provided.
zRem
Removes the specified members from the sorted set stored at key.
None
zScore
Returns the score of member in the sorted set at key.
None
zRank
Returns the rank of member in the sorted set stored at key.
None
zIncrBy
Increments the score of member in the sorted set stored at key by value.
Subject to storage quota gating (writes may be blocked if quota exceeded)
zScan
Iterates elements of sorted set types and their associated scores. Note that there is no guaranteed ordering of elements in the result.
No server-side cap; uses requested count
zRemRangeByLex
When all elements in a sorted set are inserted with the same score, this command removes the elements at key between the lexicographical range specified by min and max.
None
zRemRangeByRank
Removes all elements in the sorted set stored at key with rank between start and stop.
None
zRemRangeByScore
Removes all elements in the sorted set stored at key with a score between min and max (inclusive).
None
Code Examples
Example 1
```
// Example using zRange() with by 'score'async function sortedSetExample1() { await redis.zAdd( 'leaderboard', { member: 'louis', score: 37 }, { member: 'fernando', score: 10 }, { member: 'caesar', score: 20 }, { member: 'alexander', score: 25 } ); // Cardinality should be '4' as there are 4 elements in the leaderboard set console.log('Cardinality: ' + (await redis.zCard('leaderboard'))); // View elements with scores between 0 and 30 inclusive, sorted by score let scores = await redis.zRange('leaderboard', 0, 30, { by: 'score' }); console.log('Scores: ' + JSON.stringify(scores)); // Remove 'fernando' from the leaderboard await redis.zRem('leaderboard', ['fernando']); // View the elements sorted by score again. This time 'fernando' should not appear in the output scores = await redis.zRange('leaderboard', 0, 30, { by: 'score' }); console.log('Updated scores: ' + JSON.stringify(scores)); // View caesar's score console.log("Caesar's score: " + (await redis.zScore('leaderboard', 'caesar')));}
```
```
Cardinality: 4Scores: [{"score":10,"member":"fernando"},{"score":20,"member":"caesar"},{"score":25,"member":"alexander"}]Updated scores: [{"score":20,"member":"caesar"},{"score":25,"member":"alexander"}]Caesar's score: 20
```
Example 2
```
// Example using zRange() with by 'lex'async function sortedSetExample2() { await redis.zAdd( 'checkpoints', { member: 'delta', score: 0 }, { member: 'omega', score: 0 }, { member: 'alpha', score: 0 }, { member: 'charlie', score: 0 } ); // View elements between the words 'alpha' and 'fox' inclusive, sorted lexicographically // Note that 'by: "lex"' only works if all elements have the same score const members = await redis.zRange('checkpoints', 'alpha', 'fox', { by: 'lex' }); console.log('Members: ' + JSON.stringify(members));}
```
```
Members: [{"score":0,"member":"alpha"},{"score":0,"member":"charlie"},{"score":0,"member":"delta"}]
```
Example 3
```
// Example using zRange() with by 'rank'async function sortedSetExample3() { await redis.zAdd( 'grades', { member: 'sam', score: 80 }, { member: 'norma', score: 95 }, { member: 'alex', score: 77 }, { member: 'don', score: 84 }, { member: 'zeek', score: 92 } ); // View elements with a rank between 2 and 4 inclusive. Note that ranks start at index 0. const members = await redis.zRange('grades', 2, 4, { by: 'rank' }); console.log('Members: ' + JSON.stringify(members));}
```
```
Members: [{"score":84,"member":"don"},{"score":92,"member":"zeek"},{"score":95,"member":"norma"}]
```
Example 4
```
// Example using zRank() and zIncrBy()async function sortedSetExample4() { await redis.zAdd( 'animals', { member: 'zebra', score: 92 }, { member: 'cat', score: 100 }, { member: 'dog', score: 95 }, { member: 'elephant', score: 97 } ); // View the rank of 'dog' in the animals set // Rank should be '1' since 'dog' has the second lowest score. Note that ranks start at index 0. console.log("Dog's rank: " + (await redis.zRank('animals', 'dog'))); // View the rank of 'zebra' console.log("Zebra's rank: " + (await redis.zRank('animals', 'zebra'))); // Increase the score of 'dog' by 10 await redis.zIncrBy('animals', 'dog', 10); // View the rank of 'dog' again. This time it should be '3' because dog has the highest score. console.log( "Dog's rank after incrementing score: " + (await redis.zRank('animals', 'dog')) );}
```
```
Dog's rank: 1Zebra's rank: 0Dog's rank after incrementing score: 3
```
Example 5
```
// Example using zRemRangeByLex()async function sortedSetExample5() { await redis.zAdd( 'fruits', { member: 'kiwi', score: 0 }, { member: 'mango', score: 0 }, { member: 'banana', score: 0 }, { member: 'orange', score: 0 }, { member: 'apple', score: 0 } ); // Remove fruits alphabetically ordered between 'kiwi' inclusive and 'orange' exclusive // Note: The symbols '[' and '(' indicate inclusive or exclusive, respectively. These must be included in the call to zRemRangeByLex(). await redis.zRemRangeByLex('fruits', '[kiwi', '(orange'); // Only 'apple', 'banana', and 'orange' should remain in the set const zScanResponse = await redis.zScan('fruits', 0); console.log('zScanResponse: ' + JSON.stringify(zScanResponse));}
```
```
zScanResponse: {"cursor":0,"members":[{"score":0,"member":"apple"},{"score":0,"member":"banana"},{"score":0,"member":"orange"}]}
```
Example 6
```
// Example using zRemRangeByRank()async function sortedSetExample6() { await redis.zAdd( 'fruits', { member: 'kiwi', score: 10 }, { member: 'mango', score: 20 }, { member: 'banana', score: 30 }, { member: 'orange', score: 40 }, { member: 'apple', score: 50 } ); // Remove fruits ranked 1 through 3 inclusive await redis.zRemRangeByRank('fruits', 1, 3); // Only 'kiwi' and 'apple' should remain in the set const zScanResponse = await redis.zScan('fruits', 0); console.log('zScanResponse: ' + JSON.stringify(zScanResponse));}
```
```
zScanResponse: {"cursor":0,"members":[{"score":10,"member":"kiwi"},{"score":50,"member":"apple"}]}
```
Example 7
```
// Example using zRemRangeByScore() exampleasync function sortedSetExample7() { await redis.zAdd( 'fruits', { member: 'kiwi', score: 10 }, { member: 'mango', score: 20 }, { member: 'banana', score: 30 }, { member: 'orange', score: 40 }, { member: 'apple', score: 50 } ); // Remove fruits scored between 30 and 50 inclusive await redis.zRemRangeByScore('fruits', 30, 50); // Only 'kiwi' and 'mango' should remain in the set const zScanResponse = await redis.zScan('fruits', 0); console.log('zScanResponse: ' + JSON.stringify(zScanResponse));}
```
```
zScanResponse: {"cursor":0,"members":[{"score":10,"member":"kiwi"},{"score":20,"member":"mango"}]}
```
### Bitfield​
Command
Action
Limits
bitfield
Performs a sequence of operations on a bit string
Subject to storage quota gating (writes may be blocked if quota exceeded)
Code Example
```
async function bitfieldExample() { const setBits: number[] = await redis.bitfield('foo', 'set', 'i5', '#0', 11); console.log('Set result: ' + setBits); // [0] const getBits: number[] = await redis.bitfield('foo', 'get', 'i5', '#0'); console.log('Get result: ' + setBits); // [11] const manyOperations: number[] = await redis.bitfield( 'bar', 'set', 'u2', 0, 3, 'get', 'u2', 0, 'incrBy', 'u2', 0, 1, 'overflow', 'sat', 'get', 'u2', 0, 'set', 'u2', 0, 3, 'incrBy', 'u2', 0, 1 ); console.log('Results of many operations: ' + manyOperations); // [0, 3, 0, 0, 3, 3]}
```
```
fooResults: [1, 0]barResults: [0, 3, 0, 0, 3, 3]
```
## Compression (Experimental)​
The Redis package includes a
```
redisCompressed
```
client that transparently handles compression and decompression of values. This is useful for storing large strings or JSON objects that exceed the Redis storage limits or to optimize storage usage.
To use it, update your import:
```
// import { redis } from '@devvit/redis';import { redisCompressed as redis } from '@devvit/redis';
```
warning
One-Way Migration: Once you start using
```
redisCompressed
```
and writing compressed data, switching back to the standard
```
redis
```
client will result in errors when reading that data, as the standard client does not know how to decompress the values.
The
```
redisCompressed
```
client automatically:
Compresses values on write (
```
set
```
,
```
hSet
```
,
```
mSet
```
,
```
hSetNX
```
) if it saves space.
Decompresses values on read (
```
get
```
,
```
hGet
```
,
```
mGet
```
,
```
hMGet
```
,
```
hGetAll
```
).
Note: Existing uncompressed data is not automatically compressed when read. It is only compressed when you write it back. To migrate existing large datasets, you need to read and re-write the data.
### Migration Example​
Migrating large datasets can take time. To avoid the 30-second execution timeout, we recommend using a scheduled job that processes data in chunks and "daisy chains" itself until completion.
Here is an example of how to implement a migration tool using a Menu Item and the Scheduler.
Register your form handler, menu trigger, and scheduler endpoint here.
```
{ "forms": { "migrateExampleForm": "/internal/form/ops/migrate-example" }, "menu": { "items": [ { "label": "[ops] Migrate Data to Compression", "location": "subreddit", "forUserType": "moderator", "endpoint": "/internal/menu/ops/migrate-example" } ] }, "scheduler": { "tasks": { "migrate-example-data": { "endpoint": "/internal/scheduler/migrate-example-data" } } }}
```
Add these route handlers to your server.
Hono
Express
```
import { redis, scheduler, type TaskRequest, type TaskResponse } from '@devvit/web/server';// Import the compressed clientimport { redisCompressed } from '@devvit/redis';import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';type MigrateExampleFormRequest = { startCursor?: string; chunkSize?: number;};type MigrateExampleJobData = { cursor?: number | string; chunkSize?: number; processed?: number;};const MY_DATA_HASH_KEY = 'my:app:large:dataset';// 1. Menu Endpoint: Returns the form definitionapp.post('/internal/menu/ops/migrate-example', async (c) => { const _request = await c.req.json<MenuItemRequest>(); return c.json<UiResponse>({ showForm: { name: 'migrateExampleForm', // Must match key in devvit.json "forms" form: { title: 'Migrate Hash to Compression', acceptLabel: 'Start Migration', fields: [ { name: 'startCursor', label: 'Start Cursor (0 for beginning)', type: 'string', defaultValue: '0', }, { name: 'chunkSize', label: 'Items per batch', type: 'number', defaultValue: 20000, }, ], }, }, });});// 2. Form Handler: Receives input and schedules the first jobapp.post('/internal/form/ops/migrate-example', async (c) => { const body = await c.req.json<MigrateExampleFormRequest>().catch( () => ({} as MigrateExampleFormRequest) ); const cursor = body.startCursor || '0'; const size = Number(body.chunkSize) || 20000; console.log(`[Migration] Manual start requested. Cursor: ${cursor}, Chunk: ${size}`); // Kick off the first job in the chain await scheduler.runJob({ name: 'migrate-example-data', runAt: new Date(), // Run immediately data: { cursor, chunkSize: size, processed: 0, }, }); return c.json<UiResponse>({ showToast: { text: 'Migration started in background', appearance: 'success', }, });});// 3. Scheduler Endpoint: The recursive workerapp.post('/internal/scheduler/migrate-example-data', async (c) => { const startTime = Date.now(); try { const body = await c.req.json<TaskRequest<MigrateExampleJobData>>().catch( () => ({} as TaskRequest<MigrateExampleJobData>) ); const data = body.data; let cursor = Number(data?.cursor) || 0; const chunkSize = Number(data?.chunkSize) || 20000; const processedTotal = Number(data?.processed) || 0; console.log(`[Migration] Job started. Cursor: ${cursor}, Target Chunk: ${chunkSize}`); let keepRunning = true; let processedInJob = 0; const SCAN_COUNT = 250; // Internal batch size to keep event loop moving while (keepRunning) { // Stop if we've processed enough items for this single execution if (processedInJob >= chunkSize) { break; } const { cursor: nextCursor, fieldValues } = await redis.hScan( MY_DATA_HASH_KEY, cursor, undefined, // match pattern SCAN_COUNT ); // Parallel Processing: // We treat the batch as a set of promises to execute simultaneously. // Promise.allSettled ensures one failure doesn't crash the whole job. await Promise.allSettled( fieldValues.map(async ({ field, value }) => { // LOGIC: // 1. We read the raw value. // 2. We write it back using 'redisCompressed'. // The proxy detects the write and compresses the string if beneficial. if (value && value.length > 0) { await redisCompressed.hSet(MY_DATA_HASH_KEY, { [field]: value }); } }) ); processedInJob += fieldValues.length; // Cursor logic: 0 means iteration is complete if (nextCursor === 0) { cursor = 0; keepRunning = false; } else { cursor = nextCursor; } // Safety: Check execution time. // If we are close to 30s (Devvit limit), stop early and requeue. if (Date.now() - startTime > 20000) { console.log('[Migration] Time limit approaching, stopping early.'); keepRunning = false; } } const newTotal = processedTotal + processedInJob; // Daisy Chaining: // If the cursor is not 0, we still have more data to scan. // We schedule *this same job* to run again immediately. if (cursor !== 0) { console.log(`[Migration] Requeueing. Next cursor: ${cursor}. Processed so far: ${newTotal}`); await scheduler.runJob({ name: 'migrate-example-data', runAt: new Date(), data: { cursor, chunkSize, processed: newTotal, }, }); return c.json<TaskResponse>({ status: 'requeued', processed: newTotal, cursor }); } console.log(`[Migration] COMPLETE. Total items processed: ${newTotal}`); return c.json<TaskResponse>({ status: 'success', processed: newTotal }); } catch (error) { console.error('[Migration] Critical Job Error', error); return c.json<TaskResponse>({ status: 'error', message: error.message }, 500); }});
```
Note that the job may timeout, in which case you will need to find the last logged cursor to start the menu item action job again. Try adjusting the chunk size if you experience timeouts.
You can monitor the migration progress using the logs command:
```
devvit logs r/my-subreddit-to-migrate --since=1h --verbose
```
Previous
ModAction
Next
Cache helper
Limits and quotas
Examples
Menu actions
Games
Supported Redis commands
Simple read/write
Batch read/write
Strings
Hash
Numbers
Key expiration
Transactions
Sorted set
Bitfield
Compression (Experimental)
Migration Example
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 8.2 CacheHelper

Cache helper | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
ModAction
Saving Data
Redis
Cache helper
Post data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Saving Data
Cache helper
On this page
# Cache helper
Cache helper lets you build a more performant app by reducing the number of server side calls for the same data. You can create a short-term cache that stores JSON objects in your Devvit app for a limited amount of time. This is valuable when you have many clients trying to get the same data, for example a stock ticker value or a sports score.
Under the covers, it's Redis plus a local in-memory write-through cache. This provides a pattern for fetching data without involving a scheduler and allows small time-to-live (TTL, ~1 second). Cache helper lets the app make one request for the data, save the response, and provide this response to all users requesting the same data.
warning
Do not cache sensitive information. Cache helper randomly selects one user to make the real request and saves the response to the cache for others to use. You should only use cache helper for non-personalized fetches, since the same response is available to all users.
## Usage​
You can import cache helper from
```
@devvit/web/server
```
in your server source files. The cache helper is not available client-side, so you will see an error if you try to import it in client source files.
```
import { cache } from '@devvit/web/server';
```
## Parameters​
The cache takes a key and a TTL:
Parameters
Description
```
key
```
This is a string that identifies a cached response. Instead of making a real request, the app gets the cached response with the key you provide. Make sure to use different keys for different data. For example, if you’re saving post-specific data, add the postId to the cache key, like this:
```
post_data_${postId})
```
.
```
ttl
```
Time to live is the number of seconds the cached response is expected to be relevant. Once the cached response expires, it will be voided and a real request is made to populate the cache again. You can treat it as a threshold, where ttl of 30 would mean that a request is done no more than once per 30 seconds.
## Example​
Here’s a way to set up in-app caching instead of using scheduler or interval to fetch.
Hono
Express
server/index.ts
```
import { Hono } from 'hono';import { cache, context, createServer, getServerPort, reddit } from '@devvit/web/server';type SubredditResponse = { type: 'subreddit'; subreddit: string;};type SubredditErrorResponse = { status: 'error'; message: string;};const app = new Hono();app.get('/api/subreddit', async (c) => { const { postId } = context; if (!postId) { console.error('API Subreddit Error: postId not found in devvit context'); return c.json<SubredditErrorResponse>( { status: 'error', message: 'postId is required but missing from context', }, 400 ); } try { const subredditName = await cache( async () => { const subreddit = await reddit.getCurrentSubreddit(); if (!subreddit) { throw new Error('Subreddit is required but missing from context'); } return subreddit.name; }, { key: 'current_subreddit', ttl: 24 * 60 * 60, // expire after one day. } ); console.log(`Current subreddit: ${subredditName}`); return c.json<SubredditResponse>({ type: 'subreddit', subreddit: subredditName, }); } catch (error) { console.error(`API Subreddit Error for post ${postId}:`, error); let errorMessage = 'Unknown error during subreddit retrieval'; if (error instanceof Error) { errorMessage = `Subreddit retrieval failed: ${error.message}`; } return c.json<SubredditErrorResponse>({ status: 'error', message: errorMessage }, 400); }});const server = createServer(app);server.on('error', (err) => console.error(`server error; ${err.stack}`));server.listen(getServerPort());
```
Previous
Redis
Next
Post data
Usage
Parameters
Example
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 8.3 PostData

Post data | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
ModAction
Saving Data
Redis
Cache helper
Post data
User Input
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
Saving Data
Post data
On this page
# Post data
You can attach small amounts of data (2KB) to a post when creating it and update this data using the
```
postData
```
capability. This enables dynamic, stateful experiences available on posts without a server call. Post data is scoped to the post, not users.
Post data is useful for storing game state, scores, or any other information that needs to persist with the post and be shared across all users.
Post data is set when you submitPost and apps can access from the context object or do a server side call to update the post data on a Post object. For larger data, use redis.
note
Post data is sent to the client. Never store secrets or sensitive information.
## Creating posts with data​
When creating a post, include the
```
postData
```
parameter with your custom data object.
Hono
Express
server/index.ts
```
import { context, reddit } from '@devvit/web/server';import type { JsonObject } from '@devvit/web/shared';type CreatePostResponse = { postId: string; message: string;};type ErrorResponse = { error: string;};app.post('/api/create-post', async (c) => { const { subredditName } = context; if (!subredditName) { return c.json<ErrorResponse>({ error: 'Subreddit name is required' }, 400); } const postData: JsonObject = { challengeNumber: 42, totalGuesses: 0, gameState: 'active', pixels: [ [0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0], [0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 0], [0, 0, 0, 2, 2, 1, 1, 1, 0, 0, 0], [0, 0, 2, 2, 1, 1, 1, 1, 1, 0, 0], [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0], [1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1], [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0], [0, 0, 2, 2, 1, 1, 1, 1, 1, 0, 0], [0, 0, 0, 2, 2, 1, 1, 1, 0, 0, 0], [0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 0], [0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0] ], }; const post = await reddit.submitCustomPost({ subredditName, title: 'Post with custom data', entry: 'default', postData, }); return c.json<CreatePostResponse>({ postId: post.id, message: 'Post created successfully', });});
```
## Updating post data​
To update post data after creation, fetch the post and use the
```
setPostData()
```
method.
Hono
Express
server/index.ts
```
import { context, reddit } from '@devvit/web/server';import type { JsonObject } from '@devvit/web/shared';type UpdatePostDataRequest = { favoriteColor?: string; username?: string;};type UpdatePostDataResponse = { success: true; message: string;};type ErrorResponse = { error: string;};app.post('/api/update-post-data', async (c) => { const { postId } = context; const { favoriteColor, username } = await c.req.json<UpdatePostDataRequest>(); if (!postId) { return c.json<ErrorResponse>({ error: 'Post ID is required' }, 400); } try { const post = await reddit.getPostById(postId); // Get existing post data to merge with updates const currentData = (context.postData || {}) as JsonObject; await post.setPostData({ ...currentData, favoriteColor: favoriteColor || 'unknown', lastUpdatedBy: username || 'anonymous', lastUpdatedAt: new Date().toISOString(), }); return c.json<UpdatePostDataResponse>({ success: true, message: 'Post data updated successfully', }); } catch (error) { console.error('Error updating post data:', error); return c.json<ErrorResponse>({ error: 'Failed to update post data' }, 500); }});
```
warning
```
setPostData()
```
replaces the entire post data object. To update specific fields while preserving others, merge the existing data with your updates.
## Accessing post data​
Post data is available through
```
context.postData
```
in both client and server contexts.
client/index.tsx
```
import { context } from '@devvit/web/client';export const App = () => { return ( <div> <div className='mt-1 font-bold'>Post Data:</div> <pre>{JSON.stringify(context.postData, null, 2) ?? 'undefined'}</pre> </div> );}
```
## Limitations​
Post data supports:
JSON-serializable objects only
Maximum size of 2KB
Data persists with the post lifecycle (deleted when post is deleted)
Updates to post data don't trigger automatic re-renders. Implement polling or refresh mechanisms as needed
Previous
Cache helper
Next
Media Uploads
Creating posts with data
Updating post data
Accessing post data
Limitations
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 9.1 Media Uploads

Media Uploads | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
ModAction
Saving Data
Redis
Cache helper
Post data
User Input
Media Uploads
Forms
User Actions
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
User Input
Media Uploads
On this page
# Media Uploads
warning
Apps can only display images hosted on Reddit
You can upload images to Reddit at runtime using the
```
media
```
capability. This is different than static images, which you bundle with your app's client assets.
Runtime images are useful for embedding images in RTJSON (Posts and Comments) as well as displaying them within an interactive post app.
## Enabling media uploads​
Enable the
```
media
```
permission in your
```
devvit.json
```
file.
devvit.json
```
{ "permissions": { "media": true }}
```
## Using media uploads​
On the server, you can pass the URL of any remotely hosted image (even if its not hosted on Reddit) to the
```
media.upload
```
function. This function will return a Reddit URL. Both HTTP and data URLs are supported.
server/index.ts
```
import { media } from '@devvit/media';function submitImage() { const response = await media.upload({ url: 'https://media2.giphy.com/media/xTiN0CNHgoRf1Ha7CM/giphy.gif', type: 'gif', });}
```
## Canvas screenshots​
The Canvas API is fully supported by Devvit. You can use it to capture screenshots of your app's current state and upload them using the media API.
This is useful for letting users share their progress, achievements, or creations as image posts. Sharing screenshots is an effective way to build community engagement and increase visibility for your app.
client/screenshot.ts
```
// Capture the canvas as a data URLconst canvas = document.querySelector('canvas');const dataUrl = canvas.toDataURL('image/png');// Send to server endpoint for uploadconst response = await fetch('/api/upload-screenshot', { method: 'POST', body: JSON.stringify({ image: dataUrl }),});
```
server/index.ts
```
import { media } from '@devvit/media';app.post('/api/upload-screenshot', async (c) => { const { image } = await c.req.json(); const response = await media.upload({ url: image, // data URL from canvas type: 'png', }); return c.json({ url: response.mediaUrl });});
```
## Limitations​
The formats supported are PNG, JPEG, WEBP, and GIF.
The maximum file size allowed is 20 MB.
### Notes​
When uploading a WEBP image, it will be converted to JPEG. As such, the Reddit URL returned points to a JPEG image.
Previous
Post data
Next
Forms
Enabling media uploads
Using media uploads
Canvas screenshots
Limitations
Notes
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 9.2 Forms

Forms | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
ModAction
Saving Data
Redis
Cache helper
Post data
User Input
Media Uploads
Forms
User Actions
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
User Input
Forms
On this page
# Forms
A form lets your app ask users to input and submit data. Forms can be defined with a simple form object that takes a list of fields, and return user responses directly as promises.
## Using forms​
Promise-based forms:
client/index.ts
```
import { showForm } from '@devvit/web/client';// Show form and get user response directlyconst result = await showForm({ form: { fields: [ { type: 'string', name: 'name', label: 'Name', }, ], }, data: { name: 'Default value' } // Optional initial data});// Handle form submission result immediatelyif (result) { const { name } = result; // Process the data directly console.log(`User entered: ${name}`); // Chain additional actions await fetch('/api/save-name', { method: 'POST', body: JSON.stringify({ name }) }); // Or show another form in sequence const step2 = await showForm({ form: { fields: [ { type: 'string', name: 'food', label: 'Favorite food?', }, ], } }); if (step2) { console.log(`Multi-step complete: ${name}, ${step2.food}`); }} else { console.log('User cancelled the form');}
```
### Parameters​
```
showForm(options)
```
→ Returns Promise
```
form
```
(Form): The form specification object
```
data
```
(FormValues, optional): Initial form field values
Returns:
```
Promise<FormValues | null>
```
- Resolves with form data or null if cancelled
## Menu response forms​
For forms that open from a menu item, you can use menu responses. This is useful since you do not have access to the
```
@devvit/web/client
```
library from a menu item endpoint.
Configure forms in devvit.json:
devvit.json
```
{ "forms": { "nameForm": "/internal/form/name-submit", "reviewForm": "/internal/form/review-submit" }}
```
Server endpoint that shows form via menu response:
Hono
Express
server/index.ts
```
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';type NameFormRequest = { name: string };type ReviewFormRequest = { review: string };// Menu action that triggers menu response formapp.post('/internal/menu/start-workflow', async (c) => { const _input = await c.req.json<MenuItemRequest>(); // Server processing before showing form const userData = await fetchUserData(); return c.json<UiResponse>({ showForm: { name: 'nameForm', form: { fields: [ { type: 'string', name: 'name', label: 'Name', }, ], }, data: { name: userData.name } // Pre-populate from server } });});// Form submission handler that can chain to another formapp.post('/internal/form/name-submit', async (c) => { const { name } = await c.req.json<NameFormRequest>(); // Server processing await saveUserName(name); // Show next form in workflow return c.json<UiResponse>({ showForm: { name: 'reviewForm', form: { fields: [ { type: 'paragraph', name: 'review', label: 'How was your experience?', }, ], } } });});app.post('/internal/form/review-submit', async (c) => { const { review } = await c.req.json<ReviewFormRequest>(); await saveReview(review); return c.json<UiResponse>({ showToast: 'Thank you for your feedback!' });});
```
## Form object​
The form object enables you to customize the form container and the list of form fields included.
#### Usage​
```
const myForm = { title: 'My form', description: 'This is my form. There are many like it, but this one is mine.', fields: [ { type: 'string', name: 'food', label: 'What is your favorite food?', }, { type: 'string', name: 'drink', label: 'What is your favorite drink?', }, ], acceptLabel: 'Submit', cancelLabel: 'Cancel',};
```
#### Supported properties​
Property
Supported types
Description
```
title
```
```
string
```
```
undefined
```
An optional title for the form
```
description
```
```
string
```
```
undefined
```
An optional description for the form
```
fields
```
```
FormField[]
```
The fields that will be displayed in the form
```
acceptLabel
```
```
string
```
```
undefined
```
An optional label for the submit button
```
cancelLabel
```
```
string
```
```
undefined
```
An optional label for the cancel button
## Supported fields types​
The following field types are supported: String, Select, Paragraph, Number, Boolean, Image, and Group.
### String​
A single-line text input.
#### Usage​
```
const stringField = { type: 'string', name: 'title', label: 'Tournament title',};
```
#### Properties​
Property
Supported types
Description
```
type
```
```
string
```
The desired field type.
```
name
```
```
string
```
The name of the field. This will be used as the key in the
```
values
```
object when the form is submitted.
```
label
```
```
string
```
The label of the field. This will be displayed to the user.
```
helpText
```
```
string
```
```
undefined
```
An optional help text that will be displayed below the field.
```
required
```
```
boolean
```
```
undefined
```
If true the field will be required and the user will not be able to submit the form without filling it in. Defaults to
```
false
```
.
```
disabled
```
```
boolean
```
```
undefined
```
If true the field will be disabled. Defaults to
```
false
```
.
```
defaultValue
```
```
ValueType
```
```
undefined
```
The default value of the field.
```
scope
```
```
SettingScopeType
```
```
undefined
```
This indicates whether the field (setting) is an app level or install level setting. App setting values can be used by any installation.
```
undefined
```
by default.
```
placeholder
```
```
string
```
```
undefined
```
Placeholder text for display before a value is present.
```
isSecret
```
```
boolean
```
```
undefined
```
Makes the form field secret.
### Select​
A dropdown menu with predefined options.
#### Usage​
```
const selectField = { type: 'select', name: 'interval', label: 'Update the leaderboard', options: [ { label: 'Hourly', value: 'hourly' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }, { label: 'Yearly', value: 'yearly' }, ],};
```
#### Properties​
Property
Supported types
Description
```
type
```
```
string
```
The desired field type.
```
name
```
```
string
```
The name of the field. This will be used as the key in the
```
values
```
object when the form is submitted.
```
label
```
```
string
```
The label of the field. This will be displayed to the user.
```
options
```
```
FieldConfig_Selection_Item[]
```
The list of options available.
```
helpText
```
```
string
```
```
undefined
```
An optional help text that will be displayed below the field.
```
required
```
```
boolean
```
```
undefined
```
If true the field will be required and the user will not be able to submit the form without filling it in. Defaults to
```
false
```
.
```
disabled
```
```
boolean
```
```
undefined
```
If true the field will be disabled. Defaults to
```
false
```
.
```
defaultValue
```
```
string[]
```
```
undefined
```
The default value of the field. Note that the default value is wrapped in an array to support multiple selected values.
```
scope
```
```
SettingScopeType
```
```
undefined
```
This indicates whether the field (setting) is an app level or install level setting. App setting values can be used by any installation.
```
undefined
```
by default.
```
multiSelect
```
```
boolean
```
```
undefined
```
Enables users to select more than 1 item from the set.
### Paragraph​
A multi-line text input for longer responses.
#### Usage​
```
const paragraphField = { type: 'paragraph', name: 'description', label: 'Description',};
```
#### Properties​
Property
Supported types
Description
```
type
```
```
string
```
The desired field type.
```
name
```
```
string
```
The name of the field. This will be used as the key in the
```
values
```
object when the form is submitted.
```
label
```
```
string
```
The label of the field. This will be displayed to the user.
```
helpText
```
```
string
```
```
undefined
```
An optional help text that will be displayed below the field.
```
required
```
```
boolean
```
```
undefined
```
If true the field will be required and the user will not be able to submit the form without filling it in. Defaults to
```
false
```
.
```
disabled
```
```
boolean
```
```
undefined
```
If true the field will be disabled. Defaults to
```
false
```
.
```
defaultValue
```
```
ValueType
```
```
undefined
```
The default value of the field.
```
scope
```
```
SettingScopeType
```
```
undefined
```
This indicates whether the field (setting) is an app level or install level setting. App setting values can be used by any installation.
```
undefined
```
by default.
```
placeholder
```
```
string
```
```
undefined
```
Placeholder text for display before a value is present.
```
lineHeight
```
```
number
```
```
undefined
```
Sets the field height by number of lines.
### Number​
An input for numerical values.
#### Usage​
```
const numberField = { type: 'number', name: 'tokens', label: 'Token balance',};
```
#### Properties​
Property
Supported types
Description
```
type
```
```
string
```
The desired field type.
```
name
```
```
string
```
The name of the field. This will be used as the key in the
```
values
```
object when the form is submitted.
```
label
```
```
string
```
The label of the field. This will be displayed to the user.
```
helpText
```
```
string
```
```
undefined
```
An optional help text that will be displayed below the field.
```
required
```
```
boolean
```
```
undefined
```
If true the field will be required and the user will not be able to submit the form without filling it in. Defaults to
```
false
```
.
```
disabled
```
```
boolean
```
```
undefined
```
If true the field will be disabled. Defaults to
```
false
```
.
```
defaultValue
```
```
ValueType
```
```
undefined
```
The default value of the field.
```
scope
```
```
SettingScopeType
```
```
undefined
```
This indicates whether the field (setting) is an app level or install level setting. App setting values can be used by any installation.
```
undefined
```
by default.
### Boolean​
A yes/no or true/false type input.
#### Usage​
```
const booleanField = { type: 'boolean', name: 'enable', label: 'Enable the event',};
```
#### Properties​
Property
Supported types
Description
```
type
```
```
string
```
The desired field type.
```
name
```
```
string
```
The name of the field. This will be used as the key in the
```
values
```
object when the form is submitted.
```
label
```
```
string
```
The label of the field. This will be displayed to the user.
```
helpText
```
```
string
```
```
undefined
```
An optional help text that will be displayed below the field.
```
disabled
```
```
boolean
```
```
undefined
```
If true the field will be disabled. Defaults to
```
false
```
.
```
defaultValue
```
```
ValueType
```
```
undefined
```
The default value of the field.
```
scope
```
```
SettingScopeType
```
```
undefined
```
This indicates whether the field (setting) is an app level or install level setting. App setting values can be used by any installation.
```
undefined
```
by default.
### Image​
An image upload field.
#### Usage​
```
const imageField = { type: 'image', // This tells the form to expect an image name: 'myImage', label: 'Image goes here', required: true,};
```
#### Properties​
Property
Supported types
Description
```
type
```
```
string
```
The desired field type.
```
name
```
```
string
```
The name of the field. This will be used as the key in the
```
values
```
object when the form is submitted.
```
label
```
```
string
```
The label of the field. This will be displayed to the user.
```
helpText
```
```
string
```
```
undefined
```
An optional help text that will be displayed below the field.
```
required
```
```
boolean
```
```
undefined
```
If true the field will be required and the user will not be able to submit the form without filling it in. Defaults to
```
false
```
.
```
disabled
```
```
boolean
```
```
undefined
```
If true the field will be disabled. Defaults to
```
false
```
.
```
scope
```
```
SettingScopeType
```
```
undefined
```
This indicates whether the field (setting) is an app level or install level setting. App setting values can be used by any installation.
```
undefined
```
by default.
```
placeholder
```
```
string
```
```
undefined
```
Placeholder text for display before a value is present.
```
isSecret
```
```
boolean
```
```
undefined
```
Makes the form field secret.
#### Notes​
The formats supported are PNG, JPEG, WEBP, and GIF.
The maximum file size allowed is 20 MB.
When uploading a WEBP image, it will be converted to JPEG. As such, the Reddit URL returned points to a JPEG image.
### Group​
A collection of related fields that allows for better readability.
#### Usage​
```
const groupField = { type: 'group', label: 'This is a group of input fields', fields: [ { type: 'paragraph', name: 'description', label: 'How would you describe what happened?', }, { type: 'number', name: 'score', label: 'How would you rate your meal on a scale from 1 to 10?', }, ],};
```
#### Properties​
Property
Supported types
Description
```
type
```
```
string
```
The desired field type.
```
label
```
```
string
```
The label of the group that will be displayed to the user.
```
fields
```
```
FormField[]
```
The fields that will be displayed in the group.
```
helpText
```
```
string
```
```
undefined
```
An optional help text that will be displayed below the group.
## Examples​
Below is a collection of common use cases and patterns.
### Dynamic forms​
Client-side approach:
client/index.ts
```
import { showForm } from '@devvit/web/client';// Get user data and show form with dynamic default valuesconst user = await reddit.getCurrentUser();const result = await showForm({ form: { fields: [ { type: 'string', name: 'username', label: 'Username', }, ], }, data: { username: user?.username || '' }});if (result) { // Handle the form result console.log(`Hello ${result.username}`);}
```
Server-side approach:
devvit.json
```
{ "forms": { "dynamicForm": "/internal/form/dynamic-submit" }}
```
Hono
Express
server/index.ts
```
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';type DynamicFormRequest = { username: string };// Endpoint that shows form with dynamic dataapp.post('/internal/menu/show-dynamic-form', async (c) => { const _input = await c.req.json<MenuItemRequest>(); const user = await reddit.getCurrentUser(); return c.json<UiResponse>({ showForm: { name: 'dynamicForm', form: { fields: [ { type: 'string', name: 'username', label: 'Username', }, ], }, data: { username: user?.username || '' } } });});// Form submission handlerapp.post('/internal/form/dynamic-submit', async (c) => { const { username } = await c.req.json<DynamicFormRequest>(); return c.json<UiResponse>({ showToast: `Hello ${username}` });});
```
### Multi-step forms​
Client-side approach (Promise chaining):
client/index.ts
```
import { showForm } from '@devvit/web/client';async function multiStepForm() { // Step 1: Get name const step1Result = await showForm({ form: { fields: [ { type: 'string', name: 'name', label: "What's your name?", required: true, }, ], } }); if (!step1Result) return; // User cancelled // Step 2: Get food preference const step2Result = await showForm({ form: { fields: [ { type: 'string', name: 'food', label: "What's your favorite food?", required: true, }, ], }, data: { name: step1Result.name } // Pass data from previous step }); if (!step2Result) return; // User cancelled // Step 3: Get drink preference const step3Result = await showForm({ form: { fields: [ { type: 'string', name: 'drink', label: "What's your favorite drink?", required: true, }, ], }, data: { name: step1Result.name, food: step2Result.food } }); if (step3Result) { // All steps completed - save or process data const finalData = { ...step1Result, ...step2Result, ...step3Result }; console.log(`Thanks ${finalData.name}! You like ${finalData.food} and ${finalData.drink}.`); }}
```
Server-side approach (Separate endpoints):
devvit.json
```
{ "forms": { "step1Form": "/internal/form/step1-submit", "step2Form": "/internal/form/step2-submit", "step3Form": "/internal/form/step3-submit" }}
```
Hono
Express
server/index.ts
```
import type { UiResponse } from '@devvit/web/shared';type Step1FormRequest = { name: string };type Step2FormRequest = { name: string; food: string };type Step3FormRequest = { name: string; food: string; drink: string };// Step 1: Name formapp.post('/internal/form/step1-submit', async (c) => { const { name } = await c.req.json<Step1FormRequest>(); return c.json<UiResponse>({ showForm: { name: 'step2Form', form: { fields: [ { type: 'string', name: 'food', label: "What's your favorite food?", required: true, }, ], }, data: { name } // Pass data to next step } });});// Step 2: Food formapp.post('/internal/form/step2-submit', async (c) => { const { name, food } = await c.req.json<Step2FormRequest>(); return c.json<UiResponse>({ showForm: { name: 'step3Form', form: { fields: [ { type: 'string', name: 'drink', label: "What's your favorite drink?", required: true, }, ], }, data: { name, food } // Pass accumulated data } });});// Step 3: Final formapp.post('/internal/form/step3-submit', async (c) => { const { name, food, drink } = await c.req.json<Step3FormRequest>(); return c.json<UiResponse>({ showToast: `Thanks ${name}! You like ${food} and ${drink}.` });});
```
### One of everything​
This example includes one of each of the supported field types.
Client-side approach:
client/index.ts
```
import { showForm } from '@devvit/web/client';const result = await showForm({ form: { title: 'My favorites', description: 'Tell us about your favorite food!', fields: [ { type: 'string', name: 'food', label: 'What is your favorite food?', helpText: 'Must be edible', required: true, }, { label: 'About that food', type: 'group', fields: [ { type: 'number', name: 'times', label: 'How many times a week do you eat it?', defaultValue: 1, }, { type: 'paragraph', name: 'what', label: 'What makes it your favorite?', }, { type: 'select', name: 'healthy', label: 'Is it healthy?', options: [ { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'Maybe', value: 'maybe' }, ], defaultValue: ['maybe'], }, ], }, { type: 'boolean', name: 'again', label: 'Can we ask again?', }, ], acceptLabel: 'Submit', cancelLabel: 'Cancel', }});if (result) { console.log('Form values:', result); // Handle form submission}
```
Server-side approach:
devvit.json
```
{ "forms": { "everythingForm": "/internal/form/everything-submit" }}
```
Hono
Express
server/index.ts
```
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';type EverythingFormRequest = { food: string; times?: number; what?: string; healthy?: string[]; again?: boolean;};app.post('/internal/form/everything-submit', async (c) => { const formValues = await c.req.json<EverythingFormRequest>(); console.log('Form values:', formValues); return c.json<UiResponse>({ showToast: 'Thanks!' });});// Example showing the formapp.post('/internal/menu/show-everything-form', async (c) => { const _input = await c.req.json<MenuItemRequest>(); return c.json<UiResponse>({ showForm: { name: 'everythingForm', form: { title: 'My favorites', description: 'Tell us about your favorite food!', fields: [ { type: 'string', name: 'food', label: 'What is your favorite food?', helpText: 'Must be edible', required: true, }, { label: 'About that food', type: 'group', fields: [ { type: 'number', name: 'times', label: 'How many times a week do you eat it?', defaultValue: 1, }, { type: 'paragraph', name: 'what', label: 'What makes it your favorite?', }, { type: 'select', name: 'healthy', label: 'Is it healthy?', options: [ { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'Maybe', value: 'maybe' }, ], defaultValue: ['maybe'], }, ], }, { type: 'boolean', name: 'again', label: 'Can we ask again?', }, ], acceptLabel: 'Submit', cancelLabel: 'Cancel', } } });});
```
### Image uploads​
Client-side approach:
client/index.ts
```
import { showForm } from '@devvit/web/client';const result = await showForm({ form: { title: 'Upload an image!', fields: [ { name: 'myImage', type: 'image', // This tells the form to expect an image label: 'Image goes here', required: true, }, ], }});if (result) { const { myImage } = result; // returns an i.redd.it URL console.log('Image uploaded:', myImage); // Process the image further await fetch('/api/process-image', { method: 'POST', body: JSON.stringify({ imageUrl: myImage }) });}
```
Server-side approach:
devvit.json
```
{ "forms": { "imageForm": "/internal/form/image-submit" }}
```
Hono
Express
server/index.ts
```
import type { UiResponse } from '@devvit/web/shared';type ImageFormRequest = { myImage: string };app.post('/internal/form/image-submit', async (c) => { const { myImage } = await c.req.json<ImageFormRequest>(); // Use the mediaUrl to store in redis and display it in an <image> block, or send to external service to modify console.log('Image uploaded:', myImage); return c.json<UiResponse>({ showToast: 'Image uploaded successfully!' });});
```
Previous
Media Uploads
Next
User Actions
Using forms
Parameters
Menu response forms
Form object
Supported fields types
String
Select
Paragraph
Number
Boolean
Image
Group
Examples
Dynamic forms
Multi-step forms
One of everything
Image uploads
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

## 9.3 User Actions

User Actions | Reddit for Developers
Skip to main content
0.12
Next
0.12
0.11
```
```
ctrlK
Introduction
Welcome to Devvit
Devvit Technical Overview
App Showcase
Build Your App
Build Games
Build Mod Tools
Launch Your App
Launch Guide
Feature Guide
Reddit Developer Funds
Capabilities
Devvit Setup Overview
Devvit Configuration
Client Overview
Server Overview
Access External Endpoints
HTTP Fetch
HTTP Fetch Policy
Automation & Triggers
Scheduler
Triggers
In-App Purchases
In-App Purchases Overview
Add payments
Test Payments
Publish your app
Manage Payments
Support this app
Post Creation & Navigation
Creating a Custom Post
Navigation
Toasts
Menu actions
Settings and Secrets
Setting up view modes and entry points
Launch Screen
View Modes, Launch Screens, and Entry Points
Setting up view modes and entry points
Launch Screen Customization
Realtime Apps
Overview
Reddit API
Reddit API Overview
Reddit API Client
Classes
AuthorFlairSettings
ButtonWidget
CalendarWidget
Comment
CommunityListWidget
CustomWidget
Flair
FlairTemplate
ImageWidget
Listing
ModMailService
ModNote
Post
PostFlairSettings
PostFlairWidget
PrivateMessage
Rule
Subreddit
SubredditDescription
SubredditRulesWidget
SubredditWikiSettings
TextAreaWidget
User
Widget
WikiPage
WikiPageRevision
WikiPageSettings
Interfaces
ModAction
Saving Data
Redis
Cache helper
Post data
User Input
Media Uploads
Forms
User Actions
Guides
Best Practices
Development Tools
Migration Guides
Template Library
Using AI Tools
FAQ
Changelog
Devvit Rules
Discord
r/Devvit
User Input
User Actions
On this page
# User Actions
User actions allow your app to submit posts, submit comments, and subscribe to the current subreddit on behalf of the logged in user. These actions occur on the logged in user's account instead of the app account. This enables stronger user engagement while ensuring user control and transparency.
## What are user actions?​
By default, apps make posts or comments using their associated app account. With user actions enabled, your app can:
Create posts or comments on behalf of the user (from the post UI, a form, or a menu action)
Subscribe the user to the current subreddit
Some actions are not available to apps to prevent abuse and maintain platform integrity:
Apps cannot upvote or downvote posts or comments, either as the app account or on behalf of the logged-in user
Apps cannot follow users (on reddit.com) or add friends (on old.reddit.com), either as the app account or on behalf of the logged-in user
## Requirements​
To ensure a positive user experience and compliance with Reddit policies:
Always ask permission: Your app must always inform users before posting, commenting, or subscribing on their behalf. This can only happen on an explicit manual action, e.g. from a button.
No automated actions: Users must explicitly opt-in to the app acting on their behalf. Do not mislead or surprise users.
Establish a reporting flow: Ensure
```
userGeneratedContent
```
is correctly set for posts submitted on behalf of the user.
Do not gate any functionality: Users should not be made or encouraged to post, comment, or subscribe to continue using your app.
Keep actions separate: Do not merge posting, commenting, or subscribing with other app actions (e.g., gameplay progression). Each must remain a distinct, clear choice.
Remember the human: Follow Reddit's safety and compliance guidelines for user-generated content. Do not create spam-like content or poor user experiences in pursuit of engagement.
## Enabling user actions​
To enable user actions, add the required permissions to your
```
devvit.json
```
:
devvit.json
```
"permissions": { "reddit": { "asUser": [ "SUBMIT_POST", "SUBMIT_COMMENT", "SUBSCRIBE_TO_SUBREDDIT" ] }}
```
After enabling, you can call certain Reddit APIs on behalf of the user by passing the option
```
runAs: 'USER'
```
. The following APIs support this option:
submitPost()
submitCustomPost()
submitComment()
If
```
runAs
```
is not specified, the API will use
```
runAs: 'APP'
```
by default.
### Parameters​
Parameter
Description
```
runAs
```
The type of account to perform the action on behalf of:
```
'USER'
```
or
```
'APP'
```
. Defaults to
```
'APP'
```
.
```
userGeneratedContent
```
Text or images submitted by the user. Required for
```
submitPost()
```
with
```
runAs: 'USER'
```
for safety and compliance review.
### Differences during playtesting​
Your app version needs to be approved in order for user actions to be enabled for all users. Expect the following behavior:
Unapproved/playtest apps:
```
runAs: 'USER'
```
will operate from the app account unless the app owner takes the action.
User actions taken by the app owner will be attributed to the app owner's username.
Approved apps:
After publishing and approval,
```
runAs: 'USER'
```
will operate on behalf of the user for all users.
## Example: Submit a post as the user​
Hono
Express
server/index.ts
```
import { reddit } from '@devvit/web/server';// ...app.post('/internal/post-create', async (c) => { const { subredditName } = context; if (!subredditName) { return c.json({ status: 'error', message: 'subredditName is required' }, 400); } reddit.submitPost({ runAs: 'USER', userGeneratedContent: { text: "Hello there! This is a new post from the user's account", }, subredditName, title: 'Post Title', entry: 'default', }); return c.json({ status: 'success', message: `Post created in subreddit ${subredditName}` });});
```
## Example: Subscribe to current subreddit​
The subscribeToCurrentSubreddit() API does not take a
```
runAs
```
parameter; it subscribes as the user by default (if specified in
```
devvit.json
```
and approved).
Hono
Express
```
import { reddit } from '@devvit/web/server';app.post('/api/subscribe', async (c) => { try { await reddit.subscribeToCurrentSubreddit(); return c.json({ status: 'success' }); } catch (error) { return c.json({ status: 'error', message: 'Failed to subscribe' }, 500); }});
```
For user privacy there is no API to check if the user is already subscribed to the current subreddit. You may want to store the subscription state in Redis to provide contextually aware UI.
## Adding user actions to games​
### End-of-game actions​
✅ An example of a clear end-of-game layout:
```
Play Again
```
```
Comment My Score
```
```
Subscribe to r/your_subreddit
```
This example keeps each action separate and straightforward for the user. Playing again, commenting, and subscribing are distinct decisions and are therefore presented as distinct actions.
❌ An example of an unclear end-of-game layout:
```
Play Again and Subscribe
```
```
Post Score to Play Next Level
```
```
Comment & Continue
```
This example mixes intention and is confusing for the user. Apps like this that merge functionality (e.g. playing again) with user actions (e.g. subscribing or commenting) will be rejected during review.
### Commenting scores​
✅ The required pattern for commenting scores is:
Commenting after explicit manual action (e.g. from a button)
Commenting by the user (not the app account)
Commenting as a reply to a single stickied comment
This avoids surprising the user, enables a reporting flow, and allows the user to easily delete their score comment. Replying to a stickied comment keeps this repetitive content with low discussion value out of the way, in an area that needs to be expanded to view.
If offering a way for the user to add a custom message to their score, the comment can be posted as a top-level comment. This prioritizes human discussion and creates a more engaging comment section.
Previous
Forms
Next
Building Community Games
What are user actions?
Requirements
Enabling user actions
Parameters
Differences during playtesting
Example: Submit a post as the user
Example: Subscribe to current subreddit
Adding user actions to games
End-of-game actions
Commenting scores
Blog·The Reddit Developer Fund·r/Devvit·r/GamesOnReddit·Join our Discord
Reddit, Inc. © 2026. Built with Docusaurus.
Ask AI
#### Devvit AI Helper
This is an AI assistant with access to Devvit developer documentation and code examples. Please note that answers are generated by AI so remember to use your own judgment.
##### Can you make all this documentation into a PDF I can download.
I'm sorry, but I'm not able to create or generate PDF files. I'm a text-based assistant designed to answer questions about the Reddit Developer Platform (Devvit).
If you'd like to access the Devvit documentation, I'd suggest visiting the official documentation site directly at developers.reddit.com, where you can browse and read the docs. Most modern browsers also have a built-in "Print to PDF" feature that you can use to save individual pages as PDFs.
Is there anything specific about Devvit you'd like me to help explain or answer?
New chat
Copy
Good answer
Bad answer
Deep thinking
Powered by
kapa.ai
Protected by reCAPTCHA
reCAPTCHA
Recaptcha requires verification.
protected by reCAPTCHA

---

