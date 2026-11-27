# Antigravity 右侧浏览器 Gemini Web 协作与验收规范 (agy-gemini-web)

## 1. 三种触发方式（命令 / 自然语言 / 自主调用）
- **显式命令**：用户使用 `/gemini-web` 或点名 `gemini-web` 技能时，立即读取并执行 `gemini-web` 技能流程。
- **自然语言**：用户提到“用 Gemini 网页版 / Gemini Web / 右侧浏览器的 Gemini / 某账号的 Gemini”来查资料、跑 Deep Research、用 Canvas/Gems、生图或发指令验收时，直接激活 `gemini-web` 技能，无需用户记住命令语法。
- **工作中自主调用**：在执行复杂任务时，若遇到以下高价值场景，主 Agent **可主动调用** `gemini-web` 技能并委派右侧浏览器中的 Gemini Web 协助工作，无需等待用户手动指定：
  - 需要 **Deep Research** 做多源网页深度调研或长篇文献综述；
  - 需要调用用户账号独有的 **Gems**、**Canvas**、Gemini Web 生图或账号关联的 Google Web 上下文；
  - 需要用独立会话对关键架构方案、文档或研究假设做**二审/对抗性验收**。
  - **边界**：常规本地代码读写、终端命令和简单查文档直接由主 Agent 完成，不要为了调用而过度委派。

## 2. 必须遵守的硬约束
1. **严格走右侧内置浏览器 (`browser` subagent)**：通过 `invoke_subagent(TypeName="browser", Model="flash")` 或 `send_message` 驱动 `gemini.google.com`；禁止用 `curl`/无头脚本抓取，禁止尝试绕过 `accounts.google.com` 登录页。
2. **账号核验先行**：发送任何提示词前，必须按用户指定别名 / 邮箱 / `/u/N` 打开对应入口并核对右上角 Google 账号头像或邮箱一致；若重定向至 `accounts.google.com` 或账号不匹配，立即暂停并请用户在右侧浏览器内手动登录/切换，再通过 `send_message` 在原标签页继续。
3. **发指令 + 闭环验收**：必须等待 Gemini Web 生成完全结束、提取完整正文并按验收标准核验（不达标则在原对话内 `send_message` 追问修正），同时对照 `BROWSER_HOST_FACTS` 确认真实访问了 `https://gemini.google.com`。
4. **复用空闲浏览器子代理**：单次任务完成后保留空闲的 `browser` 子代理（零 Token 开销），后续追问或验收优先用 `send_message` 复用同一会话标签页。
