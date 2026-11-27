# Gemini Web Browser-Use Playbook

Operational reference for the `browser` subagent interacting with
`https://gemini.google.com` inside Antigravity's right-hand browser pane.

## 1. Multi-Account Entry & Verification

- **Indexed session**: `https://gemini.google.com/u/0/app`, `/u/1/app`, `/u/2/app`.
  Google assigns `/u/0` to the primary signed-in account in the browser profile
  and increments for each additional signed-in Google account.
- **Email-targeted session**: `https://gemini.google.com/app?authuser=user@example.com`.
  When `user@example.com` is already signed into the browser profile, Google
  automatically resolves it to the right `/u/N/app` URL without visiting
  `accounts.google.com`.
- **Mandatory pre-send check**: Inspect the top-right Google Account button
  (usually an `<a>` or `<button>` whose `aria-label` starts with
  `"Google Account:"` or `"Google 账号："` and contains the account name and
  email). Never send a prompt if the visible email contradicts the requested
  account.
- **When redirected to `accounts.google.com`**: Stop immediately and return
  `BLOCKED / AUTH_REQUIRED`. The user signs in directly in the right-hand
  browser pane, and the parent agent resumes the same tab via `send_message`.

## 2. Core UI Interaction Patterns

Gemini Web is an Angular/Material web app whose CSS classes minify across
releases. Always prefer **accessible roles, `aria-label`, semantic custom
elements, and visible text** over brittle class hashes:

| Control | Resilient Locator Strategy |
| :--- | :--- |
| **Prompt composer** | `rich-textarea [contenteditable="true"]`, `[role="textbox"]`, or `.ql-editor[contenteditable="true"]` |
| **Submit button** | Button near composer with `aria-label` matching `Send`, `Submit`, `发送` (visible once text is entered; `Enter` also submits unless Shift+Enter) |
| **Stop generating button** | Button with `aria-label` matching `Stop`, `Stop response`, `停止生成` — its disappearance is the primary signal that streaming finished |
| **Model picker** | Header / composer dropdown displaying current tier (`Fast`, `Thinking`, `Pro`, `Gemini ...`) |
| **Tools / Modes menu** | Composer chip or `Tools` / `工具` button exposing `Deep Research`, `Canvas`, `Create image`, etc. |
| **File upload (`+`)** | Composer `+` / `Upload files` / `添加文件` button -> trigger file chooser -> attach staged files from `browser_sandbox/uploads/` |
| **New chat** | Sidebar button with text/aria-label `New chat` / `发起新对话` |
| **Response container** | Latest `model-response` / `message-content` turn in the conversation thread |
| **Copy response button** | Action bar under the latest response (`aria-label` matching `Copy`, `复制`) |

## 3. Waiting for Generation to Complete

1. After clicking Send, wait for the new response turn to appear.
2. Wait until the **Stop** button is no longer present **and** the response text
   length stops increasing across two consecutive checks (~2–3 seconds apart)
   **and** response footer action buttons (`Copy`, thumbs up/down, share/more)
   are rendered.
3. Never read text mid-stream and treat it as final.

## 4. Special Modes

### Deep Research
1. Select **Deep Research** from the Tools menu before submitting.
2. After submitting, Gemini Web typically generates a **Research Plan** card
   with a **"Start research"** / **"开始研究"** button (and an "Edit plan"
   option).
3. Verify the plan covers the user's core scope. If it matches, click **"Start
   research"**.
4. Deep Research can take 2–8 minutes. Poll patiently at reasonable intervals
   until the final report renders with sources/citations and action buttons
   (`Export to Docs`, `Copy`, etc.).
5. Extract the complete report text (and note cited source links).

### Canvas
1. Select **Canvas** before submitting (or click "Open in Canvas" if offered).
2. Wait until the Canvas side editor stops updating.
3. Extract **both** the Canvas artifact content (via DOM or Copy button inside
   the Canvas toolbar) and the chat summary.

### Gems
1. Navigate directly to `https://gemini.google.com/u/<N>/gem/<gemId>` (or
   `https://gemini.google.com/gem/<gemId>?authuser=<email>`).
2. Confirm the Gem's title is displayed at the top before typing.

### Image / Visual Outputs
1. Wait until the loading skeleton/shimmer finishes and the rendered `<img>`
   element has non-zero `naturalWidth`.
2. Capture a screenshot of the generated image so the parent agent can inspect
   or confirm visual quality.

## 5. Full Extraction Rule

- Prefer reading full `innerText` / structured Markdown from the latest
  `model-response` DOM node (or clicking Copy and reading cleanly) rather than
  transcribing from a scrolled screenshot.
- Always record the current `window.location.href` once the chat ID is assigned
  (e.g. `https://gemini.google.com/u/0/app/<chatId>`) so the user can reopen
  the exact conversation later.
