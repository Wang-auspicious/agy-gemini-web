'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLI_PATH = path.join(REPO_ROOT, 'tools', 'gemini-web', 'cli.js');

const {
  addOrUpdateAccount,
  removeAccount,
  setDefaultAccount,
  listAccounts,
  buildGeminiUrl,
  resolveAccountTarget,
} = require('../tools/gemini-web/lib/accounts');
const { buildDispatchBrief } = require('../tools/gemini-web/lib/brief');
const { evaluateResponse } = require('../tools/gemini-web/lib/verify');
const { appendRunRecord, readRunRecords } = require('../tools/gemini-web/lib/ledger');
const { installPlugin, uninstallPlugin, checkStatus } = require('../install');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('plugin.json follows Antigravity manifest schema with allowed fields only', () => {
  const manifestPath = path.join(REPO_ROOT, 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const allowed = new Set([
    'name',
    'displayName',
    'version',
    'description',
    'logo',
    'suggestedPrompts',
    'author',
    'homepage',
    'repository',
    'disabled',
  ]);
  for (const key of Object.keys(manifest)) {
    assert.ok(allowed.has(key), `Unexpected top-level manifest key: ${key}`);
  }
  assert.equal(manifest.name, 'agy-gemini-web');
  assert.ok(Array.isArray(manifest.suggestedPrompts) && manifest.suggestedPrompts.length === 3);
  assert.ok(fs.existsSync(path.join(REPO_ROOT, manifest.logo)));
});

test('SKILL.md contains valid frontmatter and references exist', () => {
  const skillPath = path.join(REPO_ROOT, 'skills', 'gemini-web', 'SKILL.md');
  const raw = fs.readFileSync(skillPath, 'utf8');
  assert.match(raw, /^---\r?\nname:\s*gemini-web\r?\ndescription:/);
  assert.ok(
    fs.existsSync(path.join(REPO_ROOT, 'skills', 'gemini-web', 'references', 'browser-playbook.md')),
  );
  assert.ok(
    fs.existsSync(
      path.join(REPO_ROOT, 'skills', 'gemini-web', 'references', 'acceptance-rubric.md'),
    ),
  );
});

test('account registry CRUD and URL routing (/u/N, authuser, Gem)', () => {
  const dir = makeTempDir('agy-gw-acc-');
  const cfg = path.join(dir, 'accounts.json');

  const first = addOrUpdateAccount(cfg, {
    alias: 'personal',
    email: 'me@gmail.com',
    uIndex: 0,
    model: 'thinking',
  });
  assert.equal(first.defaultAccount, 'personal');
  assert.equal(first.account.preferredModel, 'Thinking');

  addOrUpdateAccount(cfg, {
    alias: 'work',
    email: 'alice@company.com',
    uIndex: 2,
    model: 'pro',
    mode: 'deep-research',
    setDefault: true,
  });

  const listed = listAccounts(cfg);
  assert.equal(listed.defaultAccount, 'work');
  assert.equal(listed.accounts.length, 2);

  const resolvedDefault = resolveAccountTarget(cfg);
  assert.equal(resolvedDefault.alias, 'work');
  assert.equal(resolvedDefault.url, 'https://gemini.google.com/u/2/app');
  assert.match(resolvedDefault.verifyHint, /alice@company\.com/);

  const resolvedGem = resolveAccountTarget(cfg, 'work', {
    gem: 'https://gemini.google.com/u/0/gem/abc123XYZ',
  });
  assert.equal(resolvedGem.url, 'https://gemini.google.com/u/2/gem/abc123XYZ');

  const inlineEmail = resolveAccountTarget(cfg, 'guest@edu.org');
  assert.equal(inlineEmail.url, 'https://gemini.google.com/app?authuser=guest%40edu.org');

  const inlineIndex = resolveAccountTarget(cfg, '/u/3');
  assert.equal(inlineIndex.url, 'https://gemini.google.com/u/3/app');

  setDefaultAccount(cfg, 'personal');
  assert.equal(resolveAccountTarget(cfg).alias, 'personal');

  const removed = removeAccount(cfg, 'personal');
  assert.equal(removed.existed, true);
  assert.equal(removed.defaultAccount, 'work');

  assert.throws(
    () => buildGeminiUrl({ chatUrl: 'https://evil.example.com/app' }),
    /must stay on https:\/\/gemini\.google\.com/,
  );

  fs.rmSync(dir, { recursive: true, force: true });
});

test('brief builder includes account gate, auth boundary, mode, uploads and acceptance criteria', () => {
  const dir = makeTempDir('agy-gw-brief-');
  const cfg = path.join(dir, 'accounts.json');
  addOrUpdateAccount(cfg, {
    alias: 'work',
    email: 'alice@company.com',
    uIndex: 1,
    model: 'Pro',
  });

  const result = buildDispatchBrief({
    configPath: cfg,
    account: 'work',
    mode: 'deep-research',
    task: 'Compare top 3 browser automation frameworks in 2026',
    criteria: ['Include a markdown comparison table', 'Provide at least 3 URLs'],
    uploads: ['architecture.pdf'],
    maxRounds: 3,
    newChat: true,
  });

  assert.equal(result.target.url, 'https://gemini.google.com/u/1/app');
  assert.equal(result.effectiveMode, 'deep-research');
  assert.equal(result.maxRounds, 3);
  assert.match(result.brief, /alice@company\.com/);
  assert.match(result.brief, /BLOCKED \/ AUTH_REQUIRED/);
  assert.match(result.brief, /Start research/);
  assert.match(result.brief, /architecture\.pdf/);
  assert.match(result.brief, /Include a markdown comparison table/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('acceptance verifier checks structure and generates follow-up feedback on failure', () => {
  const good = [
    '# Summary',
    'Verified findings from https://gemini.google.com/docs.',
    '```js',
    'console.log("ok");',
    '```',
  ].join('\n');

  const pass = evaluateResponse(good, {
    minChars: 40,
    mustInclude: ['Verified findings'],
    mustNotInclude: ['cannot assist'],
    requireCodeBlock: true,
    requireHeadings: true,
    requireCitations: true,
  });
  assert.equal(pass.verdict, 'PASS');
  assert.equal(pass.passed, true);
  assert.equal(pass.suggestedFollowUp, null);

  const fail = evaluateResponse('Short refusal: cannot assist.', {
    minChars: 100,
    mustInclude: ['table'],
    mustNotInclude: ['cannot assist'],
    requireHeadings: true,
  });
  assert.equal(fail.verdict, 'FAIL');
  assert.equal(fail.passed, false);
  assert.ok(fail.failedRules.length === 4);
  assert.match(fail.suggestedFollowUp, /revise the previous response/i);
});

test('run ledger appends and lists most recent records first', () => {
  const dir = makeTempDir('agy-gw-ledger-');
  const ledger = path.join(dir, 'history.jsonl');
  appendRunRecord(ledger, { account: 'personal', verdict: 'PASS', summary: 'First run' });
  appendRunRecord(ledger, {
    account: 'work',
    mode: 'deep-research',
    verdict: 'PASS',
    chatUrl: 'https://gemini.google.com/u/1/app/abc',
    summary: 'Second run',
  });

  const listed = readRunRecords(ledger, 5);
  assert.equal(listed.records.length, 2);
  assert.equal(listed.records[0].summary, 'Second run');
  assert.equal(listed.records[1].summary, 'First run');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('CLI end-to-end commands work with isolated config and ledger', () => {
  const dir = makeTempDir('agy-gw-cli-');
  const cfg = path.join(dir, 'cfg.json');
  const ledger = path.join(dir, 'ledger.jsonl');

  const addOut = execFileSync(
    process.execPath,
    [CLI_PATH, 'account', 'add', 'studio', '--email', 'studio@example.com', '--u', '1', '--config', cfg],
    { encoding: 'utf8' },
  );
  assert.equal(JSON.parse(addOut).account.uIndex, 1);

  const briefOut = execFileSync(
    process.execPath,
    [
      CLI_PATH,
      'brief',
      'build',
      '--account',
      'studio',
      '--task',
      'Review this RFC',
      '--criteria',
      'List risks',
      '--json',
      '--config',
      cfg,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(JSON.parse(briefOut).target.url, 'https://gemini.google.com/u/1/app');

  const verifyOut = execFileSync(
    process.execPath,
    [
      CLI_PATH,
      'verify',
      'check',
      '--text',
      '# RFC Review\nKey risks found: https://example.com/ref',
      '--require-headings',
      '--require-citations',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(JSON.parse(verifyOut).verdict, 'PASS');

  execFileSync(
    process.execPath,
    [CLI_PATH, 'ledger', 'log', '--account', 'studio', '--verdict', 'PASS', '--summary', 'Checked RFC', '--ledger', ledger],
    { encoding: 'utf8' },
  );
  const ledgerOut = execFileSync(
    process.execPath,
    [CLI_PATH, 'ledger', 'list', '--ledger', ledger],
    { encoding: 'utf8' },
  );
  assert.equal(JSON.parse(ledgerOut).records[0].summary, 'Checked RFC');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('install.js copies, verifies status, and uninstalls cleanly', () => {
  const dir = makeTempDir('agy-gw-install-');
  const target = path.join(dir, 'agy-gemini-web');

  const res = installPlugin({ sourceDir: REPO_ROOT, targetDir: target, mode: 'copy' });
  assert.equal(res.ok, true);

  const st1 = checkStatus(target);
  assert.equal(st1.installed, true);
  assert.deepEqual(st1.missing, []);

  const rm = uninstallPlugin(target);
  assert.equal(rm.existed, true);

  const st2 = checkStatus(target);
  assert.equal(st2.installed, false);

  fs.rmSync(dir, { recursive: true, force: true });
});
