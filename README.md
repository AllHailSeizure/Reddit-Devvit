# llmphysics-bot  2.8.2 — Moderator Guide

A modular moderation-assistance bot for [r/LLMPhysics](https://reddit.com/r/LLMPhysics), built on the [Devvit](https://developers.reddit.com/docs) platform.

---

## 1. Moderator Onboarding: How the Bot Works

This bot is designed to keep r/LLMPhysics clean and focused. It handles repetitive janitorial work automatically while providing powerful tools for manual intervention.

### Automatic Cleanup
You don't need to lift a finger for these. The bot performs the following tasks in the background:
*   **Self-Response Moderator:** Prevents the original poster from cluttering the top-level comment section by locking and removing their own follow-up comments.
*   **Depth Cap:** Keeps conversations readable. Once a thread exceeds the configured depth limit, the bot automatically locks the deepest branch.
*   **Flood Assistant:** Protects the sub from spam by limiting the number of posts a user can submit within a 24-hour window.
*   **Length Moderator:** Ensures post quality by enforcing character limits based on post flair or content type.
*   **Report Filter:** Keeps your mod queue clean by automatically ignoring reports on the bot's own activity.

### Manual Moderation Tools
Available via the **Mod Shield** icon on posts and comments:

*   **Chain Mop:**
    *   **What it does:** Recursively removes and/or locks an entire conversation thread.
    *   **Pro-tip:** You can choose to **ignore distinguished comments** during the mop, ensuring you don't accidentally remove your own or your fellow moderators' notes.

*   **Saved Responses:**
    *   **What it does:** Standardizes your community outreach.
    *   **Flexible Deployment:** When applying a response, you can choose to post **as yourself** or **as the bot**.
    *   **Distinguish:** You have full control to toggle the distinguish status on your response.
    *   **Efficiency:** You can select to **lock the target comment** simultaneously when posting your response, saving you an extra step during rule enforcement.

---

## 2. Settings Guide (v2.8.1)
Moderators can manage all bot behaviors in the **Bot Settings** menu (found under the Subreddit header overflow menu). Settings are organized into five main categories:

### Modules
Enable or disable specific features:
*   **Depth Cap Moderator**
*   **Flood Moderator**
*   **Self-Response Moderator**
*   **Length Moderator**
*   **Chain Mop**
*   **Saved Responses**
*   **Define Command**

### 

### Flood Moderator
Manage spam controls:
*   **Max posts per window:** The limit of submissions allowed for a single user within the defined timeframe.
*   **Time window (hours):** The rolling duration (in hours) to enforce the post limit.
*   **Ignore flags:** Toggle automatic exemptions for Moderators, Approved Submitters, and various types of removed/deleted posts to prevent over-moderation of legitimate activity.

### Commenting
Configure settings for comment interactions:
*   **Depth cap:** Maximum allowed depth for conversation branches before they are automatically locked.
*   **Ignore flags:** Toggle exemptions (Moderators/Approved Submitters) for both the **Depth Cap** and **Self-Response** modules.

### Posting
Configure settings for post requirements:
*   **Flair template ID for max length posts:** Specify the Reddit flair template ID that triggers these character limits.
*   **Max unhosted length:** The maximum allowed character count for posts bearing the specified flair.
*   **Min hosted length:** The minimum allowed character count required for link (hosted) posts to ensure quality discussions.

### Removal Messages
Customize the text users receive when content is removed or restricted:
*   **Bot signature:** The identifier appended to all bot comments (automatically formatted as superscript). Leave blank to disable.
*   **Custom responses:** Tailored messages for Flood, Depth Cap, Self-Response, and Length-based removals.
## 3. Interaction Commands

Any user can trigger a definition by mentioning the bot in a comment:

---

## Fetch Domains

The following external domains are requested by this app:

---

### `generativelanguage.googleapis.com` — Google Gemini API
**Why needed:** All AI-powered features in this app (the `!define` term-definition command and the Adversarial Reviewer) route through the Google Gemini API. This domain is used for:
- `POST /v1beta/models/gemini-*:generateContent` — text generation for term definitions and physics reviews
- `POST /upload/v1beta/files` — uploading PDF files to the Gemini Files API for document-aware review
- `GET /v1beta/files/{fileId}` — polling the Files API to check when an uploaded file is ready for processing

**Compliance note:** All calls are server-side. The API key is stored as a Devvit platform secret (`geminiApiKey`) and is never exposed to the client or logs. Response data is used only to compose Reddit comments posted by the bot.

---

### `en.wikipedia.org` — Wikipedia article lookup
**Why needed:** The `!define` command allows users to request definitions of physics terms by mentioning the bot in a comment. The bot fetches a summary from the Wikipedia REST API (`/api/rest_v1/page/summary/{term}`) to provide a concise, sourced definition. No user data is sent to Wikipedia — only the term extracted from the comment is included in the request URL.

---

### `arxiv.org` — arXiv preprint PDF download
**Why needed:** The Adversarial Reviewer feature allows users to request an AI physics critique of a post. When the post links to an arXiv preprint, the bot resolves the abstract URL to a direct PDF URL (e.g., `arxiv.org/pdf/2401.12345.pdf`) and downloads the PDF bytes in order to upload them to the Gemini Files API for full-paper review.

**Why this domain is required — technical constraint:** Devvit's HTTP sandbox enforces a hard **30-second timeout per `fetch()` call**. Attempting to have Gemini retrieve and review a PDF in a single synchronous call (via Gemini's `url_context` tool) reliably hits this limit for academic papers. The solution is a multi-stage pipeline: (1) resolve the PDF URL, (2) download the PDF bytes from the source domain and upload them to the Gemini Files API, (3) in a subsequent scheduler call, invoke `generateContent` with the pre-uploaded file — which Gemini can then process without any external fetch during the generation step. Step 2 requires direct HTTP access to `arxiv.org` to retrieve the PDF bytes. Without this domain, PDF-aware reviews are not possible for arXiv posts and the bot falls back to text-only review.

**Usage:** Only direct PDF URLs are fetched (e.g., `arxiv.org/pdf/*.pdf`). No user data is sent to arXiv — only the URL extracted from the post is used.

---

### `zenodo.org` — Zenodo repository PDF download
**Why needed:** Same purpose and technical constraint as `arxiv.org` above. Zenodo is a scientific data and paper repository used by physics researchers to host preprints and published manuscripts. When a post links to a Zenodo record, the bot first uses Gemini's `url_context` tool to identify the direct PDF download URL from the Zenodo landing page, then downloads the PDF bytes for upload to the Gemini Files API.

**Usage:** Only the direct PDF download URL (resolved by Gemini from the Zenodo landing page) is fetched. No user data is sent to Zenodo.

---

---

### `YOUR_PROJECT.supabase.co` — Supabase async job queue
**Why needed:** The Adversarial Reviewer's PDF review path requires downloading a full academic paper and running it through Gemini, which together take longer than Devvit's hard 30-second HTTP timeout. Supabase (listed as an approved limited-scope cloud provider in Devvit's fetch policy) provides a job queue. Devvit submits a lightweight job record to the Supabase REST API (fast, <1 second), and a Supabase Edge Function handles the PDF download and Gemini review with no timeout constraint. Devvit's scheduler polls Supabase every 5 minutes for completed results and posts the comment.

**Usage:** Devvit makes three types of calls to this domain:
1. `POST /rest/v1/review_jobs` — insert a new review job (post ID, PDF URL, title, body)
2. `GET /rest/v1/review_jobs?post_id=eq.{id}` — poll for job completion
3. No user data beyond post content (already public on Reddit) is sent

**Compliance:** The domain is the project's specific subdomain (`YOURPROJECT.supabase.co`), not a wildcard. The service role key is stored as a Devvit platform secret and never logged or exposed to the client.

---

**Summary table:**

| Domain | Feature | Call type | Data sent |
|--------|---------|-----------|-----------|
| `generativelanguage.googleapis.com` | Adversarial Reviewer, `!define` | POST (generate), POST (upload), GET (poll) | Post title, post body (truncated to 8,000 chars), PDF bytes |
| `en.wikipedia.org` | `!define` | GET | Term string only |
| `arxiv.org` | Adversarial Reviewer | GET | None (URL only) |
| `zenodo.org` | Adversarial Reviewer | GET | None (URL only) |
| `YOUR_PROJECT.supabase.co` | Adversarial Reviewer | POST (enqueue), GET (poll) | Post ID, PDF URL, post title, post body |








