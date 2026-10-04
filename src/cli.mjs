#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { countText } from './app.mjs';

const help = `Text Stats — count characters, words and lines

Usage:
  node src/cli.mjs --text STRING [--json]
  node src/cli.mjs [--json] < input.txt
  node src/cli.mjs --help
  node src/cli.mjs --version

Options:
  --text STRING  Count explicit text (including ""). Never reads stdin.
  --json         Print only characters, words and lines as JSON.
  --help         Show this help, without reading stdin.
  --version      Show the package version, without reading stdin.

Without --text, reads UTF-8 stdin; interactive stdin requires --text.
Characters: Unicode code points, including whitespace.
Words: nonempty whitespace-separated tokens.
Lines: CRLF or LF separators; no extra line for a final newline.
Empty input has zero counts; interior blank lines count.
Flags cannot be repeated. Help/version cannot combine with other modes.
--text consumes the next argument literally, even if it starts with "--".
`;

function parseArgs(args) {
  const options = { json: false, help: false, version: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (!['--text', '--json', '--help', '--version'].includes(flag)) {
      throw new Error(`Unknown argument: ${flag}. Use --help for usage.`);
    }
    if (seen.has(flag)) throw new Error(`Duplicate flag: ${flag}.`);
    seen.add(flag);
    if (flag === '--text') {
      const value = args[i + 1];
      if (value === undefined) {
        throw new Error('--text requires a string value (use --text "" for empty text).');
      }
      options.text = value;
      i += 1;
    } else {
      options[flag.slice(2)] = true;
    }
  }
  if ((options.help || options.version) && seen.size > 1) {
    throw new Error('--help and --version must be used alone.');
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(help);
    return;
  }
  if (options.version) {
    const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    process.stdout.write(`${metadata.version}\n`);
    return;
  }

  let text = options.text;
  if (text === undefined) {
    if (process.stdin.isTTY) {
      throw new Error('No input: provide --text STRING or pipe UTF-8 text into stdin.');
    }
    process.stdin.setEncoding('utf8');
    text = '';
    for await (const chunk of process.stdin) text += chunk;
  }
  const counts = countText(text);
  process.stdout.write(options.json
    ? `${JSON.stringify(counts)}\n`
    : `Characters: ${counts.characters}\nWords: ${counts.words}\nLines: ${counts.lines}\n`);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
