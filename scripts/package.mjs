import { readFileSync, lstatSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// No discovery/globbing: additions to the release must be reviewed here.
export const PACKAGE_FILES = Object.freeze([
  'README.md', 'docs/ACCEPTANCE.md', 'package.json',
  'scripts/package.mjs', 'scripts/runtime-check.mjs',
  'src/app.mjs', 'src/cli.mjs', 'test/app.test.mjs',
  'test/cli.test.mjs', 'test/text-argument.test.mjs', 'test/package.test.mjs',
]);
export function validatePath(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(name)
      || name.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('Unsafe ZIP path: ' + name);
  }
  return name;
}
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function createZip(entries) {
  const local = [], central = [], seen = new Set();
  let offset = 0;
  if (entries.length > 65535) throw new Error('Too many ZIP entries');
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const name = Buffer.from(validatePath(entry.name));
    if (seen.has(entry.name)) throw new Error('Duplicate ZIP path: ' + entry.name);
    seen.add(entry.name);
    const data = Buffer.from(entry.data);
    if (name.length > 65535 || data.length > 0xffffffff) throw new Error('ZIP entry too large');
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6); // UTF-8, stored (no compression).
    header.writeUInt16LE(0x21, 12); // Fixed 1980-01-01 DOS date.
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, data);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x800, 8);
    record.writeUInt16LE(0x21, 14);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(data.length, 20);
    record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(record, name);
    offset += header.length + name.length + data.length;
    if (offset > 0xffffffff) throw new Error('ZIP too large');
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
export function packageProject(root, outputDir) {
  root = path.resolve(root);
  outputDir = path.resolve(outputDir);
  // Reject redirected output paths before writing (including linked ancestors).
  for (let current = outputDir; ; current = path.dirname(current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error('Symlink output directory');
    }
    if (path.dirname(current) === current) break;
  }
  // Output must not overwrite any allowlisted input or an ancestor of one.
  for (const name of PACKAGE_FILES) {
    const input = path.join(root, name);
    const relative = path.relative(outputDir, input);
    if (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) {
      throw new Error('Output directory overlaps packaged inputs');
    }
  }
  const entries = PACKAGE_FILES.filter(name => {
    if (['test/cli.test.mjs', 'test/text-argument.test.mjs'].includes(name)
        && !existsSync(path.join(root, name))) return false;
    return true;
  }).map(name => {
    let current = root;
    if (lstatSync(current).isSymbolicLink()) throw new Error('Symlink input root');
    for (const part of validatePath(name).split('/')) {
      current = path.join(current, part);
      if (lstatSync(current).isSymbolicLink()) throw new Error('Symlink input: ' + name);
    }
    if (!lstatSync(current).isFile()) throw new Error('Not a file: ' + name);
    const data = readFileSync(current);
    if (data.length > 1024 * 1024) throw new Error('Input exceeds 1 MiB limit: ' + name);
    return { name, data };
  });
  const metadata = JSON.parse(entries.find(entry => entry.name === 'package.json').data);
  const stem = metadata.name + '-' + metadata.version;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(stem)) throw new Error('Unsafe package name/version');
  const zipName = stem + '.zip';
  const bytes = createZip(entries);
  const digest = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(outputDir, { recursive: true });
  const zipTarget = path.join(outputDir, zipName);
  const manifestTarget = path.join(outputDir, 'SHA256SUMS');
  // Validate BOTH targets before writing either; lstat sees dangling links too.
  for (const target of [zipTarget, manifestTarget]) {
    let stat;
    try {
      stat = lstatSync(target);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) {
      throw new Error('Unsafe output target: ' + target);
    }
  }
  writeFileSync(zipTarget, bytes);
  writeFileSync(manifestTarget, digest + '  ' + zipName + '\n');
  return { zipName, digest, files: entries.map(entry => entry.name) };
}
const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--output-dir' || !args[1])) {
      throw new Error('Usage: node scripts/package.mjs [--output-dir DIR]');
    }
    const root = fileURLToPath(new URL('..', import.meta.url));
    const output = args.length ? path.resolve(args[1]) : path.join(root, 'artifacts', 'dist');
    const result = packageProject(root, output);
    console.log('Created ' + path.join(output, result.zipName) + '\nSHA-256: ' + result.digest);
  } catch (error) {
    console.error('Packaging error: ' + error.message);
    process.exitCode = 1;
  }
}
