'use strict';

const { resolveAccountTarget } = require('./accounts');

const MODE_INSTRUCTIONS = {
  default: 'Use standard Gemini chat mode unless a specific tool chip is requested.',
  'deep-research': [
    'Enable **Deep Research** from the Tools / mode selector before submitting the prompt.',
    'If Gemini presents a research plan with a "Start research" button, review that the plan matches the task and click "Start research", then wait patiently until the full report finishes generating.',
  ].join(' '),
  canvas:
    'Enable **Canvas** from the Tools / mode selector before submitting so Gemini produces an editable Canvas document/code artifact, then extract the full Canvas content as well as the chat summary.',
  image:
    'Enable **Create image** / image generation mode from the Tools selector before submitting, wait for the image(s) to finish rendering, and take a screenshot once visible.',
  gem: 'Confirm the target Gem header is loaded before submitting the prompt.',
};

function buildDispatchBrief({
  task,
  configPath,
  account,
  model,
  mode,
  gem,
  chatUrl,
  criteria = [],
  uploads = [],
  maxRounds = 2,
  newChat = false,
}) {
  if (!task || !String(task).trim()) {
    throw new Error('A non-empty --task prompt is required to build a dispatch brief.');
  }

  const target = resolveAccountTarget(configPath, account, { model, mode, gem, chatUrl });
  const effectiveMode = target.gem && !mode ? 'gem' : target.preferredMode;
  const effectiveModel = target.preferredModel;
  const cleanCriteria = (criteria || []).map((c) => String(c).trim()).filter(Boolean);
  const cleanUploads = (uploads || []).map((u) => String(u).trim()).filter(Boolean);
  const rounds = Math.max(1, Math.min(5, Number(maxRounds) || 2));

  const lines = [
    `Navigate to ${target.url} in the built-in browser and execute the following Gemini Web task.`,
    '',
    '## 1. Account & Sign-In Gate',
    `- Target URL: ${target.url}`,
    `- Account verification: ${target.verifyHint}`,
    '- If redirected to `accounts.google.com` or shown a Google sign-in wall, STOP immediately and report `BLOCKED / AUTH_REQUIRED` so the user can sign in directly inside the right-hand browser pane. Never attempt to automate or bypass Google login.',
    '- If a DIFFERENT Google account is active than requested (wrong email or unexpected `/u/N` redirect), STOP and report the mismatch before typing anything.',
    '',
    '## 2. Chat, Model & Mode Setup',
    newChat
      ? '- Start a fresh chat ("New chat") before sending.'
      : '- Reuse the opened chat if continuing this task; otherwise start from a clean prompt composer.',
    effectiveModel !== 'auto'
      ? `- Select model tier **${effectiveModel}** in the Gemini model picker if available (report actual active model if the account does not offer ${effectiveModel}).`
      : '- Keep the current default model tier and report which model label is active.',
    `- Mode (${effectiveMode}): ${MODE_INSTRUCTIONS[effectiveMode] || MODE_INSTRUCTIONS.default}`,
  ];

  if (cleanUploads.length > 0) {
    lines.push(
      `- Attach staged upload file(s) from browser_sandbox/uploads using the upload/plus button: ${cleanUploads.join(', ')}. Wait until attachment chips finish uploading before submitting.`,
    );
  }

  lines.push(
    '',
    '## 3. Prompt to Send to Gemini Web',
    '```text',
    String(task).trim(),
    '```',
    '',
    '## 4. Wait, Extract & Acceptance Verification',
    '- Submit the prompt and wait until generation is completely finished (the Stop generating button disappears, streaming stops changing, and Copy/action buttons appear).',
    '- Extract the **complete** Gemini Web response text (prefer DOM text extraction / Copy button over cropped screenshots; include Canvas text or Deep Research report sections if applicable).',
  );

  if (cleanCriteria.length > 0) {
    lines.push(
      `- Run acceptance check against ALL criteria below (up to ${rounds} total round(s) in the same chat):`,
      ...cleanCriteria.map((c, i) => `  ${i + 1}. ${c}`),
      '- If any criterion fails (missing section, truncation, wrong format, refusal, or unverified claim), send a concise targeted follow-up correction in the same chat and re-verify before reporting back.',
    );
  } else {
    lines.push(
      `- Verify the response actually answers the prompt without truncation, refusal, or formatting breakage. If clearly incomplete, send 1 targeted follow-up in the same chat (max ${rounds} rounds).`,
    );
  }

  lines.push(
    '',
    '## 5. Required Return Payload',
    '- Active account label/email observed in the UI',
    '- Active model & mode observed',
    '- Final Gemini chat URL (e.g. `https://gemini.google.com/u/.../app/...`)',
    '- Acceptance verdict (`PASS` or `NEEDS_FOLLOWUP`) with brief per-criterion notes',
    '- Full extracted response text (verbatim, untruncated)',
    '- Keep the Gemini Web tab open and idle when done so the parent agent can send follow-up instructions via `send_message`.',
  );

  return {
    target,
    effectiveMode,
    effectiveModel,
    maxRounds: rounds,
    criteria: cleanCriteria,
    uploads: cleanUploads,
    brief: lines.join('\n'),
  };
}

module.exports = {
  MODE_INSTRUCTIONS,
  buildDispatchBrief,
};
