import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { acceptanceChecks, sourceHashes } from '../scripts/runtime-check.mjs';

// These are black-box checks: each case spawns src/cli.mjs using process.execPath,
// never imports the counting implementation to compute its expected results.
for (const [name, check] of acceptanceChecks) {
  test(name, check);
}

test('runtime acceptance works from arbitrary cwd and preserves packaged sources', () => {
  const before = sourceHashes();
  const script = fileURLToPath(new URL('../scripts/runtime-check.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: tmpdir(), encoding: 'utf8', input: '', timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /CLI runtime checks passed/);
  assert.match(result.stdout, /SHA-256 unchanged/);
  assert.deepEqual(sourceHashes(), before);
});
