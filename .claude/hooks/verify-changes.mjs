// Claude Code "Stop" hook.
// When Claude finishes a turn and backend code has changed since the last passing check,
// run the format check, lint and the full test suite. If anything fails, Claude is blocked
// from finishing and gets the error output, so it must fix the problem (or explain it).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WATCHED = [
  'src',
  'tests',
  'scripts',
  'package.json',
  'package-lock.json',
  'eslint.config.js',
  '.prettierrc.json',
];
// Kept inside node_modules so it is never committed and resets on a clean install.
const STATE_FILE = join(ROOT, 'node_modules', '.cache', 'kbiz-verify-changes.json');
// Stop blocking after this many failed attempts in a row, so Claude can never loop forever.
const MAX_BLOCKS = 3;
const CHECKS = [
  { name: 'Format check', cmd: 'npm run format:check' },
  { name: 'Lint', cmd: 'npm run lint' },
  { name: 'Tests', cmd: 'npm test' },
];
const MONGO_DOWN = /ECONNREFUSED|MongoServerSelectionError|Server selection timed out/;

const readInput = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
};

const readState = () => {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
};

const writeState = (state) => {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state));
};

const listFiles = (path) => {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => listFiles(join(path, name)));
};

// One hash over the path and content of every watched file: any code change gives a new hash.
const fingerprint = () => {
  const hash = createHash('sha256');
  const files = WATCHED.flatMap((p) => listFiles(join(ROOT, p)))
    .map((file) => relative(ROOT, file).replaceAll('\\', '/'))
    .sort();
  for (const file of files) {
    hash.update(`${file}\0`);
    hash.update(readFileSync(join(ROOT, file)));
  }
  return hash.digest('hex');
};

const stripAnsi = (text) => text.replace(/\x1b\[[0-9;]*m/g, ''); // eslint-disable-line no-control-regex

const tail = (text, lines = 60) => {
  const out = stripAnsi(text).trim().split('\n').slice(-lines).join('\n');
  return out.length > 4000 ? `...${out.slice(-4000)}` : out;
};

const run = ({ name, cmd }) => {
  const res = spawnSync(cmd, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return { name, ok: res.status === 0, output: `${res.stdout ?? ''}${res.stderr ?? ''}` };
};

const reply = (payload) => process.stdout.write(JSON.stringify(payload));

const main = () => {
  if (!existsSync(join(ROOT, 'node_modules'))) return; // not installed yet: nothing to run

  const input = readInput();
  const state = readState();
  const hash = fingerprint();
  if (hash === state.passedHash) return; // no code change since the last green run

  const results = CHECKS.map(run);
  const failed = results.filter((r) => !r.ok);

  if (failed.length === 0) {
    writeState({ passedHash: hash });
    const tests = results.find((r) => r.name === 'Tests').output;
    const passed = tests.match(/(?:ℹ|#) pass (\d+)/)?.[1] ?? 'all';
    reply({
      systemMessage: `✅ Backend checks passed after code changes: format, lint, ${passed} tests.`,
    });
    return;
  }

  const testRun = failed.find((r) => r.name === 'Tests');
  if (testRun && MONGO_DOWN.test(testRun.output)) {
    reply({
      systemMessage:
        '⚠️ Backend tests could not run: MongoDB is not reachable. Start the local replica set ' +
        '(rs0) and run `npm test` before trusting this change.',
    });
    return;
  }

  const blocks = input.stop_hook_active ? (state.blocks ?? 0) + 1 : 1;
  if (blocks > MAX_BLOCKS) {
    writeState({ passedHash: state.passedHash });
    reply({
      systemMessage: `❌ Backend checks still failing after ${MAX_BLOCKS} attempts: ${failed
        .map((r) => r.name)
        .join(', ')}. Run them yourself and review before using this change.`,
    });
    return;
  }

  writeState({ passedHash: state.passedHash, blocks });
  const details = failed.map((r) => `### ${r.name} FAILED\n${tail(r.output)}`).join('\n\n');
  reply({
    decision: 'block',
    reason:
      'The backend checks failed after your code changes. Fix the cause before finishing. ' +
      'If the failure is not caused by your change, stop and explain it to the user instead.\n\n' +
      details,
  });
};

main();
