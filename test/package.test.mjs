import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, linkSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PACKAGE_FILES, createZip, crc32, validatePath, packageProject } from '../scripts/package.mjs';

function inspect(bytes) {
  const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  assert.equal(bytes.readUInt16LE(end + 20), 0);
  const count = bytes.readUInt16LE(end + 10);
  assert.equal(bytes.readUInt16LE(end + 8), count);
  let central = bytes.readUInt32LE(end + 16), local = 0;
  const files = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(bytes.readUInt32LE(central), 0x02014b50);
    assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    assert.equal(bytes.readUInt32LE(central + 42), local);
    assert.equal(bytes.readUInt16LE(local + 6), 0x800);
    assert.equal(bytes.readUInt16LE(local + 8), 0);
    assert.equal(bytes.readUInt16LE(local + 10), 0);
    assert.equal(bytes.readUInt16LE(local + 12), 0x21);
    const length = bytes.readUInt16LE(local + 26);
    const name = bytes.subarray(local + 30, local + 30 + length).toString();
    validatePath(name);
    assert.equal(bytes.readUInt16LE(local + 28), 0);
    const size = bytes.readUInt32LE(local + 18);
    assert.equal(bytes.readUInt32LE(local + 22), size);
    const data = bytes.subarray(local + 30 + length, local + 30 + length + size);
    assert.equal(crc32(data), bytes.readUInt32LE(local + 14));
    assert.equal(bytes.readUInt32LE(central + 16), crc32(data));
    assert.equal(bytes.readUInt32LE(central + 20), size);
    assert.equal(bytes.readUInt32LE(central + 24), size);
    assert.equal(bytes.subarray(central + 46, central + 46 + length).toString(), name);
    assert.equal(files.has(name), false);
    files.set(name, data);
    local += 30 + length + size;
    central += 46 + length;
  }
  assert.equal(local, bytes.readUInt32LE(end + 16));
  assert.equal(central, end);
  assert.equal(bytes.readUInt32LE(end + 12), end - local);
  return files;
}

test('stored ZIP has valid CRCs, headers, offsets and stable order', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const entries = [{ name: 'src/a.mjs', data: Buffer.from('😀\r\n') }, { name: 'README.md', data: Buffer.alloc(0) }];
  const zip = createZip(entries);
  assert.deepEqual(zip, createZip([...entries].reverse()));
  const files = inspect(zip);
  assert.deepEqual([...files.keys()], ['README.md', 'src/a.mjs']);
  for (const entry of entries) assert.deepEqual(files.get(entry.name), entry.data);
});
test('rejects unsafe and duplicate paths', () => {
  for (const name of ['/abs', '../secret', 'a/../b', 'a//b', 'a\\b', 'C:/a', './a', 'a/', 'a\0b']) {
    assert.throws(() => createZip([{ name, data: '' }]), /Unsafe ZIP path/);
  }
  assert.throws(() => createZip([{ name: 'a', data: '' }, { name: 'a', data: '' }]), /Duplicate/);
});
test('isolated package uses only allowlist, hashes ZIP and preserves bytes', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'text-stats-package-'));
  try {
    const root = path.join(temp, 'project'), out = path.join(temp, 'output');
    mkdirSync(root);
    const before = new Map();
    for (const name of PACKAGE_FILES) {
      const file = path.join(root, name);
      mkdirSync(path.dirname(file), { recursive: true });
      const bytes = name === 'package.json'
        ? Buffer.from('{"name":"text-stats","version":"1.0.0"}\n')
        : Buffer.from(name + '\r\n😀\n');
      writeFileSync(file, bytes);
      before.set(name, bytes);
    }
    writeFileSync(path.join(root, '.env'), 'secret');
    mkdirSync(path.join(root, 'node_modules'));
    writeFileSync(path.join(root, 'node_modules', 'excluded'), 'dependency');
    const result = packageProject(root, out);
    const zip = readFileSync(path.join(out, result.zipName));
    const files = inspect(zip);
    assert.deepEqual([...files.keys()].sort(), [...PACKAGE_FILES].sort());
    for (const [name, bytes] of before) {
      assert.deepEqual(files.get(name), bytes);
      assert.deepEqual(readFileSync(path.join(root, name)), bytes);
    }
    const hash = createHash('sha256').update(zip).digest('hex');
    assert.equal(result.digest, hash);
    assert.equal(readFileSync(path.join(out, 'SHA256SUMS'), 'utf8'), hash + '  ' + result.zipName + '\n');
    packageProject(root, out);
    assert.deepEqual(readFileSync(path.join(out, result.zipName)), zip);
    assert.throws(() => packageProject(root, root), /overlaps/);
    assert.throws(() => packageProject(root, path.join(root, 'src')), /overlaps/);
    writeFileSync(path.join(root, 'src/app.mjs'), Buffer.alloc(1024 * 1024 + 1));
    assert.throws(() => packageProject(root, out), /1 MiB/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

for (const kind of ['hard link', 'symlink', 'dangling symlink', 'directory']) {
  for (const targetName of ['text-stats-1.0.0.zip', 'SHA256SUMS']) {
    test('rejects ' + kind + ' at ' + targetName + ' before any artifact write', t => {
      const temp = mkdtempSync(path.join(tmpdir(), 'text-stats-links-'));
      try {
        const root = path.join(temp, 'project'), out = path.join(temp, 'output');
        mkdirSync(root);
        mkdirSync(out);
        const before = new Map();
        for (const name of PACKAGE_FILES) {
          const file = path.join(root, name);
          mkdirSync(path.dirname(file), { recursive: true });
          const data = Buffer.from(name === 'package.json'
            ? '{"name":"text-stats","version":"1.0.0"}\n'
            : name + '\r\nsource bytes\n');
          writeFileSync(file, data);
          before.set(name, data);
        }
        const source = path.join(root, 'src/app.mjs');
        const target = path.join(out, targetName);
        if (kind === 'hard link') linkSync(source, target);
        else if (kind === 'directory') mkdirSync(target);
        else {
          try {
            symlinkSync(kind === 'dangling symlink' ? path.join(root, 'missing') : source, target, 'file');
          } catch (error) {
            if (['EPERM', 'EACCES'].includes(error.code)) {
              t.skip('Platform denied symlink creation: ' + error.code);
              return;
            }
            throw error;
          }
        }
        const other = path.join(out, targetName === 'SHA256SUMS' ? 'text-stats-1.0.0.zip' : 'SHA256SUMS');
        const sentinel = Buffer.from('existing other artifact must remain unchanged');
        writeFileSync(other, sentinel);
        assert.throws(() => packageProject(root, out), /Unsafe output target/);
        assert.deepEqual(readFileSync(other), sentinel);
        for (const [name, data] of before) {
          assert.deepEqual(readFileSync(path.join(root, name)), data);
        }
        if (kind === 'dangling symlink') assert.equal(existsSync(path.join(root, 'missing')), false);
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });
  }
}
