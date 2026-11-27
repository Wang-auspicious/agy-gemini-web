#!/usr/bin/env node
'use strict';

const {
  addOrUpdateAccount,
  removeAccount,
  setDefaultAccount,
  listAccounts,
  resolveAccountTarget,
} = require('./lib/accounts');
const { buildDispatchBrief } = require('./lib/brief');
const { evaluateResponse, evaluateResponseFile } = require('./lib/verify');
const { appendRunRecord, readRunRecords } = require('./lib/ledger');

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const multiFlags = new Set(['criteria', 'upload', 'must-include', 'must-not-include']);

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      let key;
      let val;
      if (eq !== -1) {
        key = tok.slice(2, eq);
        val = tok.slice(eq + 1);
      } else {
        key = tok.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          val = next;
          i++;
        } else {
          val = true;
        }
      }
      if (multiFlags.has(key)) {
        if (!Array.isArray(flags[key])) flags[key] = [];
        if (val !== true) flags[key].push(val);
      } else {
        flags[key] = val;
      }
    } else if (tok === '-h') {
      flags.help = true;
    } else {
      positional.push(tok);
    }
  }
  return { positional, flags };
}

function printHelp() {
  process.stdout.write(
    [
      'agy-gemini-web CLI (zero-dependency account routing, brief builder & acceptance verifier)',
      '',
      'Commands:',
      '  account add <alias> [--email <addr>] [--u <index>] [--model <auto|Fast|Thinking|Pro>] [--mode <default|deep-research|canvas|image|gem>] [--note <text>] [--default]',
      '  account list',
      '  account use <alias>',
      '  account remove <alias>',
      '  account resolve [alias|email|/u/N] [--gem <id|url>] [--model <...>] [--mode <...>]',
      '',
      '  brief build --task "<prompt>" [--account <alias|email|/u/N>] [--model <...>] [--mode <...>] [--gem <...>] [--chat-url <url>] [--criteria "<rule>"]... [--upload <filename>]... [--max-rounds <1-5>] [--new-chat] [--json]',
      '',
      '  verify check (--response-file <path> | --text "<text>") [--min-chars <n>] [--must-include "<str>"]... [--must-not-include "<str>"]... [--require-code-block] [--require-headings] [--require-citations] [--json]',
      '',
      '  ledger log --summary "<text>" [--account <alias>] [--mode <mode>] [--model <model>] [--chat-url <url>] [--verdict <PASS|FAIL|AUTH_REQUIRED>] [--rounds <n>]',
      '  ledger list [--limit <n>]',
      '',
      'Global options:',
      '  --config <path>   Override account config path (default: ~/.gemini/config/agy-gemini-web.json)',
      '  --ledger <path>   Override run ledger path (default: ~/.gemini/config/agy-gemini-web-history.jsonl)',
    ].join('\n') + '\n',
  );
}

function runCli(argv) {
  const { positional, flags } = parseArgs(argv);
  const [group, action, ...rest] = positional;

  if (!group || flags.help || group === 'help') {
    printHelp();
    return 0;
  }

  const configPath = typeof flags.config === 'string' ? flags.config : undefined;
  const ledgerPath = typeof flags.ledger === 'string' ? flags.ledger : undefined;

  if (group === 'account') {
    if (action === 'add') {
      const res = addOrUpdateAccount(configPath, {
        alias: rest[0],
        email: flags.email,
        uIndex: flags.u,
        model: flags.model,
        mode: flags.mode,
        note: flags.note,
        setDefault: Boolean(flags.default),
      });
      process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      return 0;
    }
    if (action === 'list') {
      const res = listAccounts(configPath);
      process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      return 0;
    }
    if (action === 'use') {
      const res = setDefaultAccount(configPath, rest[0]);
      process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      return 0;
    }
    if (action === 'remove') {
      const res = removeAccount(configPath, rest[0]);
      process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      return 0;
    }
    if (action === 'resolve') {
      const res = resolveAccountTarget(configPath, rest[0], {
        model: flags.model,
        mode: flags.mode,
        gem: flags.gem,
        chatUrl: flags['chat-url'],
      });
      process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      return 0;
    }
    throw new Error(`Unknown account subcommand "${action || ''}".`);
  }

  if (group === 'brief' && action === 'build') {
    const result = buildDispatchBrief({
      task: flags.task,
      configPath,
      account: flags.account,
      model: flags.model,
      mode: flags.mode,
      gem: flags.gem,
      chatUrl: flags['chat-url'],
      criteria: flags.criteria || [],
      uploads: flags.upload || [],
      maxRounds: flags['max-rounds'],
      newChat: Boolean(flags['new-chat']),
    });
    if (flags.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      process.stdout.write(result.brief + '\n');
    }
    return 0;
  }

  if (group === 'verify' && action === 'check') {
    const rules = {
      minChars: flags['min-chars'] ? Number(flags['min-chars']) : 0,
      mustInclude: flags['must-include'] || [],
      mustNotInclude: flags['must-not-include'] || [],
      requireCodeBlock: Boolean(flags['require-code-block']),
      requireHeadings: Boolean(flags['require-headings']),
      requireCitations: Boolean(flags['require-citations']),
    };
    const res = flags['response-file']
      ? evaluateResponseFile(flags['response-file'], rules)
      : evaluateResponse(flags.text || '', rules);
    process.stdout.write(JSON.stringify(res, null, 2) + '\n');
    return res.passed ? 0 : 2;
  }

  if (group === 'ledger') {
    if (action === 'log') {
      const res = appendRunRecord(ledgerPath, {
        account: flags.account,
        mode: flags.mode,
        model: flags.model,
        chatUrl: flags['chat-url'],
        verdict: flags.verdict,
        rounds: flags.rounds,
        summary: flags.summary,
      });
      process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      return 0;
    }
    if (action === 'list') {
      const res = readRunRecords(ledgerPath, flags.limit || 10);
      process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      return 0;
    }
    throw new Error(`Unknown ledger subcommand "${action || ''}".`);
  }

  throw new Error(`Unknown command "${group} ${action || ''}". Run with --help for usage.`);
}

if (require.main === module) {
  try {
    const code = runCli(process.argv.slice(2));
    process.exit(code);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { runCli, parseArgs };
