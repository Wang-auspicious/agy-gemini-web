# Gemini Web Acceptance Rubric

Use these criteria when dispatching a Gemini Web task or verifying the returned
response before handing it back to the user (or feeding it into local agent
work).

## Universal Baseline Checks (Every Run)

1. **Host Verification**: `BROWSER_HOST_FACTS` confirms `https://gemini.google.com`
   was visited without falling back to an unintended origin.
2. **Account Integrity**: Observed top-right Google account matches the
   requested alias / email / `/u/N`.
3. **Completion Integrity**: Response finished streaming (no cut-off mid-sentence,
   no leftover "Thinking..." placeholder, no accidental refusal).
4. **Prompt Fidelity**: Directly answers every sub-question and obeys requested
   language, structure, and constraints.

## Task-Specific Checklists

### Deep Research Report
- Plan confirmed and full report finished (not just the preliminary research plan).
- Contains structured headings, concrete findings, and explicit source URLs or
  numbered citations.
- Distinguishes verified facts from gaps or speculation.
- Suggested CLI check:
  `cli.js verify check --response-file <file> --min-chars 800 --require-headings --require-citations`

### Second-Opinion / Adversarial Review
- Lists concrete flaws, edge cases, or failure modes rather than generic praise.
- References specific components, trade-offs, or assumptions from the input.
- Ends with actionable recommendations or ranked priorities.

### Code / Canvas Artifact
- Complete, runnable or drop-in code (no `// TODO: implement rest` truncation).
- Contains fenced code block(s) or full extracted Canvas source.
- Suggested CLI check:
  `cli.js verify check --response-file <file> --require-code-block --must-not-include "TODO: implement"`

### Multimodal / Image Generation
- Image fully rendered (`naturalWidth > 0`) and verified via screenshot.
- Matches subject, aspect/composition, and text-rendering constraints (if any).
- If visibly flawed (garbled text, wrong subject, missing key element), issue a
  targeted refinement prompt in the same Gemini chat.

## Iteration Cap

- Default maximum: **2 rounds** (1 initial run + 1 targeted revision), extendable
  up to 3–5 rounds only when explicitly requested.
- If a gap still remains after the cap, return the best extracted output along
  with an honest list of remaining gaps and the Gemini chat URL so the user can
  inspect directly in the right-hand browser.
