'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const GEMINI_ORIGIN = 'https://gemini.google.com';
const VALID_MODES = new Set(['default', 'deep-research', 'canvas', 'image', 'gem']);
const VALID_MODELS = new Set(['auto', 'Fast', 'Thinking', 'Pro']);

function getDefaultConfigPath(overridePath) {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.AGY_GEMINI_WEB_CONFIG) {
    return path.resolve(process.env.AGY_GEMINI_WEB_CONFIG);
  }
  return path.join(os.homedir(), '.gemini', 'config', 'agy-gemini-web.json');
}

function emptyConfig() {
  return {
    version: 1,
    defaultAccount: null,
    accounts: {},
  };
}

function loadConfig(configPath) {
  const resolved = getDefaultConfigPath(configPath);
  if (!fs.existsSync(resolved)) {
    return { path: resolved, data: emptyConfig() };
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(raw);
  const data = {
    version: 1,
    defaultAccount: typeof parsed.defaultAccount === 'string' ? parsed.defaultAccount : null,
    accounts: parsed.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {},
  };
  return { path: resolved, data };
}

function saveConfig(configPath, data) {
  const resolved = getDefaultConfigPath(configPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const tmpPath = `${resolved}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmpPath, resolved);
  return resolved;
}

function normalizeAlias(alias) {
  if (typeof alias !== 'string' || !alias.trim()) {
    throw new Error('Account alias is required.');
  }
  const cleaned = alias.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,31}$/.test(cleaned)) {
    throw new Error(
      `Invalid alias "${alias}". Use 1-32 lowercase letters, digits, ".", "_" or "-".`,
    );
  }
  return cleaned;
}

function parseUIndex(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 20) {
    throw new Error(`Invalid Google account index "${value}". Expected integer 0-20.`);
  }
  return n;
}

function normalizeModel(model) {
  if (!model) return 'auto';
  const map = {
    auto: 'auto',
    fast: 'Fast',
    flash: 'Fast',
    thinking: 'Thinking',
    pro: 'Pro',
  };
  const key = String(model).trim().toLowerCase();
  if (map[key]) return map[key];
  return String(model).trim();
}

function normalizeMode(mode) {
  if (!mode) return 'default';
  const cleaned = String(mode).trim().toLowerCase();
  if (!VALID_MODES.has(cleaned)) {
    throw new Error(
      `Invalid mode "${mode}". Supported: ${Array.from(VALID_MODES).join(', ')}.`,
    );
  }
  return cleaned;
}

function addOrUpdateAccount(configPath, opts) {
  const alias = normalizeAlias(opts.alias);
  const { path: resolved, data } = loadConfig(configPath);
  const existing = data.accounts[alias] || {};

  const uIndex =
    opts.uIndex !== undefined ? parseUIndex(opts.uIndex) : (existing.uIndex ?? null);
  const email =
    opts.email !== undefined
      ? opts.email
        ? String(opts.email).trim()
        : null
      : (existing.email ?? null);

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Invalid email address "${email}".`);
  }
  if (uIndex === null && !email) {
    throw new Error('Specify at least --email <address> or --u <index> when registering an account.');
  }

  const record = {
    alias,
    email,
    uIndex,
    preferredModel: normalizeModel(opts.model ?? existing.preferredModel ?? 'auto'),
    preferredMode: normalizeMode(opts.mode ?? existing.preferredMode ?? 'default'),
    note: opts.note !== undefined ? String(opts.note).trim() : (existing.note ?? ''),
    updatedAt: new Date().toISOString(),
  };

  data.accounts[alias] = record;
  if (opts.setDefault || !data.defaultAccount) {
    data.defaultAccount = alias;
  }

  saveConfig(resolved, data);
  return { configPath: resolved, defaultAccount: data.defaultAccount, account: record };
}

function removeAccount(configPath, alias) {
  const key = normalizeAlias(alias);
  const { path: resolved, data } = loadConfig(configPath);
  const existed = Boolean(data.accounts[key]);
  delete data.accounts[key];
  if (data.defaultAccount === key) {
    const remaining = Object.keys(data.accounts);
    data.defaultAccount = remaining.length > 0 ? remaining[0] : null;
  }
  saveConfig(resolved, data);
  return { configPath: resolved, alias: key, existed, defaultAccount: data.defaultAccount };
}

function setDefaultAccount(configPath, alias) {
  const key = normalizeAlias(alias);
  const { path: resolved, data } = loadConfig(configPath);
  if (!data.accounts[key]) {
    throw new Error(`Account alias "${key}" not found.`);
  }
  data.defaultAccount = key;
  saveConfig(resolved, data);
  return { configPath: resolved, defaultAccount: key };
}

function listAccounts(configPath) {
  const { path: resolved, data } = loadConfig(configPath);
  const accounts = Object.values(data.accounts).map((acc) => ({
    ...acc,
    isDefault: acc.alias === data.defaultAccount,
    url: buildGeminiUrl({ uIndex: acc.uIndex, email: acc.email }),
  }));
  return { configPath: resolved, defaultAccount: data.defaultAccount, accounts };
}

function extractGemId(gem) {
  if (!gem) return null;
  const trimmed = String(gem).trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/gemini\.google\.com\/(?:u\/\d+\/)?gem\/([a-zA-Z0-9_-]+)/i);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]{4,128}$/.test(trimmed)) return trimmed;
  throw new Error(`Invalid Gem identifier or URL "${gem}".`);
}

function buildGeminiUrl({ uIndex = null, email = null, gem = null, chatUrl = null } = {}) {
  if (chatUrl) {
    const parsed = new URL(chatUrl);
    if (parsed.origin !== GEMINI_ORIGIN) {
      throw new Error(`Chat URL must stay on ${GEMINI_ORIGIN}, got ${parsed.origin}.`);
    }
    return parsed.toString();
  }

  const gemId = extractGemId(gem);
  const suffix = gemId ? `gem/${gemId}` : 'app';

  if (uIndex !== null && uIndex !== undefined) {
    const idx = parseUIndex(uIndex);
    return `${GEMINI_ORIGIN}/u/${idx}/${suffix}`;
  }

  if (email) {
    const url = new URL(`${GEMINI_ORIGIN}/${suffix}`);
    url.searchParams.set('authuser', String(email).trim());
    return url.toString();
  }

  return `${GEMINI_ORIGIN}/${suffix}`;
}

function resolveAccountTarget(configPath, selector, extra = {}) {
  const { path: resolved, data } = loadConfig(configPath);
  const rawSelector = selector !== undefined && selector !== null ? String(selector).trim() : '';

  let account = null;
  let source = 'active-browser-default';

  if (rawSelector) {
    const lower = rawSelector.toLowerCase();
    if (data.accounts[lower]) {
      account = data.accounts[lower];
      source = 'alias';
    } else {
      const byEmail = Object.values(data.accounts).find(
        (acc) => acc.email && acc.email.toLowerCase() === lower,
      );
      if (byEmail) {
        account = byEmail;
        source = 'registered-email';
      } else if (/^\/?u\/(\d+)\/?$/i.test(rawSelector) || /^\d+$/.test(rawSelector)) {
        const match = rawSelector.match(/(\d+)/);
        const idx = parseUIndex(match[1]);
        const byIndex = Object.values(data.accounts).find((acc) => acc.uIndex === idx);
        account = byIndex || {
          alias: `u${idx}`,
          email: null,
          uIndex: idx,
          preferredModel: 'auto',
          preferredMode: 'default',
          note: '',
        };
        source = byIndex ? 'registered-u-index' : 'inline-u-index';
      } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawSelector)) {
        account = {
          alias: rawSelector.split('@')[0],
          email: rawSelector,
          uIndex: null,
          preferredModel: 'auto',
          preferredMode: 'default',
          note: '',
        };
        source = 'inline-email';
      } else {
        throw new Error(
          `Unknown account "${rawSelector}". Register it with "account add ${lower} --email <email> [--u <N>]" or pass an email or /u/N index.`,
        );
      }
    }
  } else if (data.defaultAccount && data.accounts[data.defaultAccount]) {
    account = data.accounts[data.defaultAccount];
    source = 'default-config';
  }

  const uIndex = account ? account.uIndex : null;
  const email = account ? account.email : null;
  const gem = extra.gem || null;
  const chatUrl = extra.chatUrl || null;
  const url = buildGeminiUrl({ uIndex, email, gem, chatUrl });

  const verifyHint = email
    ? `Verify the top-right Google Account avatar/tooltip shows "${email}" before sending any prompt.`
    : uIndex !== null
      ? `Verify the landed URL remains under /u/${uIndex}/ and confirm the active Google account in the top-right avatar before sending.`
      : 'Check the top-right Google Account avatar to confirm which signed-in account is active.';

  return {
    configPath: resolved,
    source,
    alias: account ? account.alias : null,
    email,
    uIndex,
    preferredModel: normalizeModel(extra.model || (account && account.preferredModel) || 'auto'),
    preferredMode: normalizeMode(extra.mode || (account && account.preferredMode) || 'default'),
    gem: extractGemId(gem),
    url,
    verifyHint,
  };
}

module.exports = {
  GEMINI_ORIGIN,
  VALID_MODES,
  VALID_MODELS,
  getDefaultConfigPath,
  loadConfig,
  saveConfig,
  normalizeAlias,
  parseUIndex,
  addOrUpdateAccount,
  removeAccount,
  setDefaultAccount,
  listAccounts,
  buildGeminiUrl,
  resolveAccountTarget,
};
