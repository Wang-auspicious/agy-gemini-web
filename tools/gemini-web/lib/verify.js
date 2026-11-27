'use strict';

const fs = require('fs');

function evaluateResponse(text, rules = {}) {
  const content = typeof text === 'string' ? text : '';
  const trimmed = content.trim();
  const checks = [];

  const minChars = Number(rules.minChars || 0);
  if (minChars > 0) {
    const passed = trimmed.length >= minChars;
    checks.push({
      rule: `minChars(${minChars})`,
      passed,
      detail: `observed ${trimmed.length} chars`,
    });
  } else {
    const passed = trimmed.length > 0;
    checks.push({
      rule: 'nonEmpty',
      passed,
      detail: `observed ${trimmed.length} chars`,
    });
  }

  for (const needle of rules.mustInclude || []) {
    const s = String(needle);
    const passed = trimmed.toLowerCase().includes(s.toLowerCase());
    checks.push({
      rule: `mustInclude("${s}")`,
      passed,
      detail: passed ? 'matched' : 'missing expected text',
    });
  }

  for (const forbidden of rules.mustNotInclude || []) {
    const s = String(forbidden);
    const passed = !trimmed.toLowerCase().includes(s.toLowerCase());
    checks.push({
      rule: `mustNotInclude("${s}")`,
      passed,
      detail: passed ? 'absent' : 'found forbidden text',
    });
  }

  if (rules.requireCodeBlock) {
    const passed = /```[\s\S]*?```/.test(trimmed);
    checks.push({
      rule: 'requireCodeBlock',
      passed,
      detail: passed ? 'fenced code block present' : 'no fenced code block found',
    });
  }

  if (rules.requireHeadings) {
    const passed = /^#{1,6}\s+\S/m.test(trimmed);
    checks.push({
      rule: 'requireHeadings',
      passed,
      detail: passed ? 'markdown heading present' : 'no markdown heading found',
    });
  }

  if (rules.requireCitations) {
    const passed = /https?:\/\/[^\s)]+|\[\d+\]/.test(trimmed);
    checks.push({
      rule: 'requireCitations',
      passed,
      detail: passed ? 'citation or URL present' : 'no URL or numbered citation found',
    });
  }

  const failed = checks.filter((c) => !c.passed);
  const verdict = failed.length === 0 ? 'PASS' : 'FAIL';

  return {
    verdict,
    passed: failed.length === 0,
    charCount: trimmed.length,
    checks,
    failedRules: failed.map((c) => c.rule),
    suggestedFollowUp:
      failed.length === 0
        ? null
        : `Please revise the previous response to fix these acceptance gaps: ${failed
            .map((c) => `${c.rule} (${c.detail})`)
            .join('; ')}.`,
  };
}

function evaluateResponseFile(filePath, rules = {}) {
  const text = fs.readFileSync(filePath, 'utf8');
  return evaluateResponse(text, rules);
}

module.exports = {
  evaluateResponse,
  evaluateResponseFile,
};
