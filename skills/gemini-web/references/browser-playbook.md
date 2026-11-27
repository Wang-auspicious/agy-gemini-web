# Gemini Web Browser-Use Playbook

Operational reference for the `browser` subagent interacting with
`https://gemini.google.com` inside Antigravity's right-hand browser pane
(verified live against Gemini Web in Antigravity's built-in browser).

## 1. Multi-Account Entry & Persistent Session Hygiene

- **Indexed session**: `https://gemini.google.com/u/0/app`, `/u/1/app`, `/u/2/app`.
  Google assigns `/u/0` to the primary signed-in account in the browser profile
  and increments for each additional signed-in Google account.
- **Email-targeted session**: `https://gemini.google.com/app?authuser=user@example.com`.
  When that email is already signed into the built-in browser profile, Google
  routes it to the matching `/u/N/app` session without touching
  `accounts.google.com`.
- **Mandatory pre-send check**: Inspect the top-right Google Account button
  whose `aria-label` starts with `"Google Account:"` (English UI) or
  `"Google 账号："` (Chinese UI) and includes the active name and email. Never
  send a prompt if the visible email contradicts the requested account.
- **Never sign out or clear cookies**: Never click `"Sign out of all accounts"`,
  never open `accounts.google.com` to switch accounts when `/u/N` already works,
  and never reset browser storage. Staying on `https://gemini.google.com/u/<N>/app`
  preserves multi-account cookies across turns and conversations.
- **When redirected to `accounts.google.com`**: Stop immediately and return
  `BLOCKED / AUTH_REQUIRED`. The user signs in directly in the right-hand
  browser pane, and the parent agent resumes the same tab via `send_message`.

## 2. Live-Verified UI Locators & Playwright Pitfalls

Gemini Web is an Angular/Material web app whose CSS classes minify across
releases. Always prefer **accessible roles, `aria-label`, semantic custom
elements, and visible text**:

| Control | Live-Verified Resilient Locator & Tip |
| :--- | :--- |
| **Prompt composer** | `rich-textarea div.ql-editor[role="textbox"][contenteditable="true"]` — prefer `.fill(...)` directly; plain `.click()` can fail hit-testing due to inner overlay nodes. |
| **Submit button** | `div[data-test-id="send-button-container"] gem-icon-button.send-button.submit button[aria-label="Send message"]` (or Chinese `发送`) — Material ripple/icon spans can intercept pointer events; use `{ force: true }` or press `Enter` after filling. |
| **Stop generating button** | `gem-icon-button.send-button.stop button[aria-label="Stop response"]` (or `停止生成`) — disappears when streaming completes. |
| **Model / mode picker** | `button[aria-label^="Open mode picker"]` or `button[aria-label^="打开模式选择器"]` — exposes `Auto`, `Everyday help`, `Deeper analysis`, `Code & complex work`, and `Thinking level` (`menuitemradio`). |
| **Upload & Tools (`+`)** | `simplified-input-menu gem-icon-button.menu-button button[aria-label="Upload & tools"]` (`aria-haspopup="menu"`) — opens `gem-menu[aria-label="Menu options"]`. |
| **Top-level Tools items** | `gem-menu-item[role="menuitem"]`: `Files`, `More uploads`, `Search Google`, `Create image`, `Create video`, `Create music`, `More tools`. |
| **Submenu Tools (`More tools`)** | Hover or press `ArrowRight` on `More tools` to reach `Canvas`, `Deep research`, `Guided Learning`, etc. |
| **Above-composer pills** | `Chat` and `Task` toggle pills above the composer. |
| **New chat** | `button[aria-label="New Chat"]` (or `发起新对话`) — use `{ force: true }` if Material ripple intercepts clicks. |
| **Response container** | Latest `model-response` / `message-content` turn in the conversation thread. |
| **Completion actions** | Footer buttons under latest `model-response`: `Good response`, `Bad response`, `Redo`, `Share & export`, `Copy`. |

## 3. Waiting for Generation & Stall Recovery

1. After submitting, wait for the new `model-response` turn to appear.
2. Wait until `button[aria-label="Stop response"]` is no longer visible **and**
   response text length stops growing across two consecutive checks (~2–3 s
   apart) **and** the `Copy` / feedback footer buttons render.
3. **Stall recovery**: If a heavy tier stalls for >90–120 seconds with `Stop
   response` still spinning and an empty `model-response` container (outside
   Deep Research, which legitimately takes 2–8 minutes), click `Stop response`,
   open a `New Chat`, switch the mode picker to `Auto` (unless the user
   strictly pinned a specific tier), and retry cleanly.

## 4. Special Modes

### Deep Research
1. Open `Upload & tools` -> `More tools` -> select **Deep research** before
   submitting.
2. After submitting, Gemini Web presents a **Research Plan** card with a
   **"Start research"** / **"开始研究"** button.
3. Verify the plan covers the user's core scope, click **"Start research"**,
   and wait patiently (2–8 minutes) until the full cited report finishes
   generating.
4. Extract the complete report text and cited URLs.

### Canvas
1. Open `Upload & tools` -> `More tools` -> select **Canvas** before
   submitting.
2. Wait until the Canvas side editor stops updating.
3. Extract **both** the Canvas artifact content (via DOM or Copy button inside
   the Canvas toolbar) and the chat summary.

### Gems
1. Navigate directly to `https://gemini.google.com/u/<N>/gem/<gemId>` (or
   `https://gemini.google.com/gem/<gemId>?authuser=<email>`).
2. Confirm the Gem's title is displayed before typing.

### Image / Video / Visual Outputs
1. Open `Upload & tools` -> `Create image` (or `Create video`).
2. Wait until the loading shimmer disappears and the rendered `<img>` has
   non-zero `naturalWidth`.
3. Capture a screenshot so the parent agent can inspect visual quality.

## 5. Full Extraction Rule

- Prefer reading full `innerText` / structured Markdown from the latest
  `model-response` DOM node (or using the `Copy` button) rather than
  transcribing from a scrolled screenshot.
- Always record the current `window.location.href` once the chat ID is assigned
  (e.g. `https://gemini.google.com/u/1/app/<chatId>`) so the user can reopen
  the exact conversation later.
