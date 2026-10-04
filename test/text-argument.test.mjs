import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    input: 'stdin must not override explicit text',
    timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

for (const literal of ['--example', '--help', '--version', '--json', '--text']) {
  test(`--text accepts flag-looking literal ${literal}`, () => {
    const result = run(['--text', literal, '--json']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      characters: literal.length,
      words: 1,
      lines: 1,
    });
  });
}

test('--text accepts an explicit empty string', () => {
  const result = run(['--text', '', '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), { characters: 0, words: 0, lines: 0 });
});

test('--text without a following argument fails clearly', () => {
  const result = run(['--text']);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /--text requires a string value/);
});
