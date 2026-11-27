# AGY-Gemini-Web

> **Use Gemini Web (`gemini.google.com`) directly inside Google Antigravity's built-in right-hand browser — with multi-account routing (`/u/N` & `authuser`), explicit `/gemini-web` skill command, zero-ceremony natural language, autonomous agent self-invocation, and closed-loop browser-use acceptance verification. Pure Node.js (`0` external dependencies).**

Native Antigravity plugin (`plugin.json` + `rules/AGENTS.md` + `skills/gemini-web/` + CLI tools) designed along the clean zero-dependency conventions of `agy-unstick` and `agy-tokless`.

---

## 10-Second Install Inside Antigravity

Paste this prompt into any Antigravity chat window:

```text
Please clone https://github.com/Wang-auspicious/agy-gemini-web locally and run `node install.js --copy` to globally install and enable the `agy-gemini-web` plugin, then verify it with `node install.js --status`.
```

Or install manually from terminal:

```bash
git clone https://github.com/Wang-auspicious/agy-gemini-web.git
cd agy-gemini-web
node ./install.js --copy
node ./install.js --status
```

---

## Three Ways to Trigger

1. **Explicit Skill Command (`/gemini-web`)**
   ```text
   /gemini-web 用 work 账号跑一份关于 MCP 生态的 Deep Research，要求带来源链接和对比表，验收通过后整理给我
   ```
2. **Simple Natural Language (No Command Needed)**
   ```text
   帮我在右侧浏览器切到个人账号的 Gemini 网页版，用 Canvas 写一份演讲稿大纲，顺便检查一下结构完不完整
   ```
3. **Autonomous Agent Self-Invocation (`rules/AGENTS.md`)**
   During complex tasks, the primary Antigravity agent can proactively delegate to Gemini Web in the right-hand browser whenever it adds clear value:
   - Multi-source **Deep Research** reports
   - Account-specific **Gems**, **Canvas**, or Gemini Web image generation
   - Independent **second-opinion / adversarial review** in a fresh web session

---

## How It Works

```text
User prompt / Agent self-invocation
  │
  ├─ 1. Account Router (cli.js account resolve)
  │     Maps alias ("work", "personal") / email / "/u/1" -> exact gemini.google.com URL + verify hint
  │
  ├─ 2. Dispatch Brief Builder (cli.js brief build)
  │     Injects account verification gate, mode (Deep Research / Canvas / Image / Gem),
  │     staged uploads, completion detection, and acceptance criteria
  │
  ├─ 3. Built-in Right-Hand Browser (`browser` subagent)
  │     - Respects `accounts.google.com` auth boundary (pauses for user sign-in in the pane, never bypasses)
  │     - Verifies top-right Google account matches target before sending
  │     - Submits prompt, waits for full completion, extracts complete response + chat URL
  │
  └─ 4. Closed-Loop Acceptance (`verify check` + `send_message` reuse)
        - Checks `BROWSER_HOST_FACTS` + acceptance rubric
        - Sends targeted follow-up in the SAME tab if incomplete/off-format
        - Keeps idle browser subagent alive (0 token cost) for follow-up turns
```

---

## Multi-Account Configuration (Zero Secrets Stored)

Account routing metadata is stored locally in `~/.gemini/config/agy-gemini-web.json` (aliases, emails, `/u/N` indices, preferred model/mode — **never** passwords, cookies, or tokens; login stays strictly inside the right-hand browser).

```bash
# Register accounts
node ./tools/gemini-web/cli.js account add personal --email me@gmail.com --u 0 --model Thinking --default
node ./tools/gemini-web/cli.js account add work --email me@company.com --u 1 --model Pro --mode deep-research

# List or switch default
node ./tools/gemini-web/cli.js account list
node ./tools/gemini-web/cli.js account use work

# Resolve exact entry URL & verification hint
node ./tools/gemini-web/cli.js account resolve work
node ./tools/gemini-web/cli.js account resolve work --gem myGemId123
```

---

## CLI Reference (`tools/gemini-web/cli.js`)

| Command | Purpose |
| :--- | :--- |
| `account add/list/use/remove/resolve` | Manage Google account aliases and resolve `/u/N`, `?authuser=`, and Gem URLs |
| `brief build` | Generate a structured browser-use dispatch & acceptance prompt for the `browser` subagent |
| `verify check` | Deterministically check extracted Gemini Web text (`--min-chars`, `--must-include`, `--must-not-include`, `--require-code-block`, `--require-headings`, `--require-citations`) |
| `ledger log / list` | Record and inspect recent Gemini Web runs in `~/.gemini/config/agy-gemini-web-history.jsonl` |

---

## Security & Platform Guardrails

- **Never automates or bypasses `accounts.google.com`**: When an account is not yet signed in, the right-hand browser pauses (`BLOCKED / AUTH_REQUIRED`) so you sign in directly in the pane, then resumes seamlessly via `send_message` in the same tab.
- **Account mismatch protection**: Refuses to send prompts if the active Google account avatar does not match the requested account.
- **Host-fact verification**: Cross-checks `BROWSER_HOST_FACTS` before trusting any subagent claim.

---

## Local Verification

```bash
npm test
node ./install.js --copy
node ./install.js --status
```

---

## License

[MIT](./LICENSE)
