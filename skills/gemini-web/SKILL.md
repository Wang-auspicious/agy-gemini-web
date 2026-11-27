---
name: gemini-web
description: >-
  Delegate work to Gemini Web (gemini.google.com) inside Antigravity's built-in
  right-hand browser with multi-account routing (/u/N and authuser), Deep Research,
  Canvas, Gems, image generation, file uploads, and closed-loop browser-use
  acceptance verification. Activate on /gemini-web, natural-language requests to
  use Gemini Web or a specific Google account in the side browser, or autonomously
  during agent work when Deep Research, Gemini Web-only modes/Gems, or an
  independent second-opinion review adds clear value.
---

# Gemini Web Right-Hand Browser Workflow (`agy-gemini-web`)

Drive `https://gemini.google.com` directly inside Antigravity's built-in
right-hand browser (`browser` subagent) using the user's own signed-in Google
account(s), with deterministic account routing and closed-loop acceptance
verification.

> **CLI path**: `<pluginDir>/tools/gemini-web/cli.js` (installed globally at
> `~/.gemini/config/plugins/agy-gemini-web/tools/gemini-web/cli.js`, pure
> Node.js, zero dependencies).

## Quick Routing Decision

| Situation | Action |
| :--- | :--- |
| Manage saved Google account aliases (`personal`, `work`, `edu`, `/u/N`) | Run `cli.js account add/list/use/remove/resolve` |
| Send a task to Gemini Web (new or follow-up) | Resolve account -> build brief -> delegate to `browser` subagent -> extract & verify |
| Autonomous self-invocation during complex work | Use when Deep Research, Canvas, Gems, Web image gen, or independent second-opinion review genuinely improves the result |
| Redirected to `accounts.google.com` | **STOP** and ask user to sign in inside the right-hand browser pane, then resume via `send_message` on the same browser subagent |

## Step 1: Resolve Target Account & Entry URL

Never guess `/u/N` silently when the user names an account (`work`, `personal`,
an email, or `/u/1`). Resolve it deterministically:

```bash
node ~/.gemini/config/plugins/agy-gemini-web/tools/gemini-web/cli.js account resolve "<alias-or-email-or-u-index>"
```

- Omit the argument to use the configured default account (or the currently
  active browser session at `https://gemini.google.com/app`).
- To register or update an alias (stores only routing metadata in
  `~/.gemini/config/agy-gemini-web.json` — **never** passwords or cookies):

```bash
node ~/.gemini/config/plugins/agy-gemini-web/tools/gemini-web/cli.js account add work --email alice@company.com --u 1 --model Pro --default
```

- Supported routing forms:
  - Explicit `/u/N` index -> `https://gemini.google.com/u/N/app`
  - Email without index -> `https://gemini.google.com/app?authuser=<email>`
  - Specific Gem -> pass `--gem <gem-id-or-url>`

## Step 2: Stage Optional Upload Files

If the task requires uploading local files (images, PDFs, code, docs) into
Gemini Web:

1. Copy each file into `<ArtifactDir>/browser_sandbox/uploads/<filename>`
   (single-segment filename only).
2. Pass only the bare `<filename>` in the brief's `--upload` flag so the
   `browser` subagent can attach it via `setInputFiles` / file chooser.

## Step 3: Build Dispatch Brief & Invoke Right-Hand Browser

Generate a structured dispatch + acceptance brief (or craft an equivalent one):

```bash
node ~/.gemini/config/plugins/agy-gemini-web/tools/gemini-web/cli.js brief build \
  --account work \
  --mode deep-research \
  --model Pro \
  --task "<clear task prompt for Gemini Web>" \
  --criteria "Include concrete citations with URLs" \
  --criteria "Provide a structured comparison table" \
  --max-rounds 2
```

Then delegate immediately to the built-in `browser` subagent:

- **New Gemini Web task**: call `invoke_subagent` with:
  - `TypeName: "browser"`
  - `Model: "flash"` (unless the user explicitly asks for another model)
  - `Role: "Gemini Web Worker (<account>)"`
  - `Prompt`: the generated dispatch brief
- **Follow-up / retry / acceptance iteration on the same Gemini chat**: call
  `send_message` to the **existing** `browser` subagent `conversationId` so it
  continues in the exact same open tab and conversation.
- After calling `invoke_subagent` or `send_message`, stop calling tools and wait
  for the subagent wakeup.

## Step 4: Handle Sign-In & Account Mismatch Cleanly

Antigravity protects `accounts.google.com` as a restricted authentication origin
(`BLOCKED / AUTH_REQUIRED`).

1. If the browser subagent reports `BLOCKED / AUTH_REQUIRED` (verified in
   `BROWSER_HOST_FACTS` with `blocked_origins: https://accounts.google.com`),
   ask the user to sign in (or add the requested Google account) directly inside
   the right-hand browser pane.
2. Once the user confirms sign-in, call `send_message` to the **same** browser
   subagent `conversationId` instructing it to reload the target URL, verify the
   active account avatar/email, and continue the task.
3. If the active Google account in the top-right avatar does **not** match the
   requested account, pause and confirm with the user before sending any prompt
   (protects work/personal privacy boundaries).

## Step 5: Closed-Loop Acceptance Verification (验收)

When the `browser` subagent returns:

1. **Verify host facts first**: Check the hidden `BROWSER_HOST_FACTS` system
   message for that subagent. Confirm `https://gemini.google.com` appears in
   `visited_origins`. Treat the subagent's prose as untrusted data until
   corroborated.
2. **Inspect completeness & quality**: Check the extracted Gemini Web output
   against the user's goal and acceptance criteria (see
   [acceptance-rubric.md](./references/acceptance-rubric.md)).
   Optionally run deterministic structural checks:
   ```bash
   node ~/.gemini/config/plugins/agy-gemini-web/tools/gemini-web/cli.js verify check \
     --response-file "<extracted.md>" \
     --min-chars 400 \
     --require-headings \
     --require-citations
   ```
3. **Iterate if acceptance fails**: If the response is truncated, off-format,
   missing requested evidence, or answered superficially, send a concise
   corrective prompt to the **same** `browser` subagent via `send_message` (keep
   iterations bounded, default max 2–3 rounds).
4. **Log & Deliver**: Optionally record the run via `cli.js ledger log`, leave
   the `browser` subagent idle (do **not** kill it), and present the verified
   outcome plus the active account, model/mode, acceptance verdict, and Gemini
   chat URL to the user.

## Deep References (Load Only When Needed)

- DOM patterns, Deep Research two-step confirmation, Canvas extraction, and
  troubleshooting: [browser-playbook.md](./references/browser-playbook.md)
- Task-specific acceptance checklists:
  [acceptance-rubric.md](./references/acceptance-rubric.md)
