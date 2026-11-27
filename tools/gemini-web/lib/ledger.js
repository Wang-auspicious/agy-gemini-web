'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function getDefaultLedgerPath(overridePath) {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.AGY_GEMINI_WEB_LEDGER) {
    return path.resolve(process.env.AGY_GEMINI_WEB_LEDGER);
  }
  return path.join(os.homedir(), '.gemini', 'config', 'agy-gemini-web-history.jsonl');
}

function appendRunRecord(ledgerPath, entry) {
  const resolved = getDefaultLedgerPath(ledgerPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const record = {
    timestamp: new Date().toISOString(),
    account: entry.account || 'default',
    mode: entry.mode || 'default',
    model: entry.model || 'auto',
    chatUrl: entry.chatUrl || null,
    verdict: entry.verdict || 'UNKNOWN',
    rounds: Number(entry.rounds || 1),
    summary: String(entry.summary || '').trim(),
  };
  fs.appendFileSync(resolved, JSON.stringify(record) + '\n', { mode: 0o600 });
  return { ledgerPath: resolved, record };
}

function readRunRecords(ledgerPath, limit = 10) {
  const resolved = getDefaultLedgerPath(ledgerPath);
  if (!fs.existsSync(resolved)) {
    return { ledgerPath: resolved, records: [] };
  }
  const lines = fs
    .readFileSync(resolved, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      // Ignore malformed lines so history inspection never crashes.
    }
  }
  const max = Math.max(1, Number(limit) || 10);
  return {
    ledgerPath: resolved,
    records: parsed.slice(-max).reverse(),
  };
}

module.exports = {
  getDefaultLedgerPath,
  appendRunRecord,
  readRunRecords,
};
