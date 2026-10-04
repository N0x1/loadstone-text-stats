import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_FILES } from './package.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

// Every child uses the real CLI, UTF-8 pipes, bounded output/time and an unrelated
// cwd. No shell, network, dependencies or fixtures are needed.
function run(args, input = '') {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8', input, timeout: 5000, maxBuffer: 1024 * 1024,
    cwd: tmpdir(),
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'CLI must not be killed');
  return result;
}
function success(args, input = '') {
  const result = run(args, input);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '', 'successful CLI has no stderr');
  return result.stdout;
}
function json(args, input, expected) {
  assert.deepEqual(JSON.parse(success(args, input)), expected);
}

export const acceptanceChecks = [
  ['plain --text labels exact counts and overrides stdin', () => {
    assert.equal(success(['--text', 'Hello world'], 'ignored stdin'),
      'Characters: 11\nWords: 2\nLines: 1\n');
  }],
  ['plain UTF-8 piped stdin', () => {
    assert.equal(success([], 'Hi 😀\n'),
      'Characters: 5\nWords: 2\nLines: 1\n');
  }],
  ['JSON --text exact numeric keys', () => {
    json(['--json', '--text', 'Hello 😀'], 'ignored',
      { characters: 7, words: 2, lines: 1 });
  }],
  ...[
    ['empty', '', { characters: 0, words: 0, lines: 0 }],
    ['Unicode code points', '😀 e\u0301', { characters: 4, words: 2, lines: 1 }],
    ['mixed whitespace', 'a\t b\u2003c', { characters: 6, words: 3, lines: 1 }],
    ['CRLF and final newline', 'a\r\nb\r\n', { characters: 6, words: 2, lines: 2 }],
    ['interior blank and trailing newline', 'a\n\nb\n', { characters: 5, words: 2, lines: 3 }],
    ['newline only', '\n', { characters: 1, words: 0, lines: 1 }],
    ['lone CR', 'a\rb', { characters: 3, words: 2, lines: 1 }],
  ].map(([name, input, expected]) => [`JSON stdin: ${name}`, () => {
    json(['--json'], input, expected);
  }]),
  ['help standalone', () => {
    const output = success(['--help'], 'ignored');
    assert.match(output, /Usage:/);
    for (const flag of ['--text', '--json', '--help', '--version']) {
      assert.ok(output.includes(flag), `help documents ${flag}`);
    }
    assert.match(output, /UTF-8/);
  }],
  ['version matches packaged metadata', () => {
    assert.equal(success(['--version'], 'ignored'), version + '\n');
  }],
  ...[
    [['--text'], /--text requires a string value/],
    [['--unknown'], /Unknown argument/],
    [['positional'], /Unknown argument/],
    [['--json', '--json'], /Duplicate flag/],
    [['--text', 'a', '--text', 'b'], /Duplicate flag/],
    [['--help', '--help'], /Duplicate flag/],
    [['--version', '--version'], /Duplicate flag/],
    [['--help', '--version'], /must be used alone/],
    [['--help', '--text', 'a'], /must be used alone/],
    [['--version', '--text', 'a'], /must be used alone/],
    [['--help', '--json'], /must be used alone/],
    [['--version', '--json'], /must be used alone/],
  ].map(([args, message]) => [`invalid arguments: ${args.join(' ')}`, () => {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Error: /);
    assert.match(result.stderr, message);
  }]),
];

export function sourceHashes() {
  return Object.fromEntries(PACKAGE_FILES.map(name => [
    name, createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex'),
  ]));
}

export function runAcceptance() {
  const before = sourceHashes();
  try {
    for (const [, check] of acceptanceChecks) check();
  } finally {
    assert.deepEqual(sourceHashes(), before, 'all packaged source SHA-256 hashes unchanged');
  }
  console.log(`CLI runtime checks passed (${acceptanceChecks.length}); SHA-256 unchanged for ${PACKAGE_FILES.length} packaged files.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAcceptance();
}
