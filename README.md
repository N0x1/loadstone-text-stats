# Loadstone Text Stats

A local, offline text statistics CLI. Requires **Node.js 22 or newer**.
No third-party dependencies, network access or `npm install` needed.

## Use

From the project or extracted ZIP directory:

```sh
node src/cli.mjs --text "Hello world"
node src/cli.mjs --text "Hello 😀" --json
node src/cli.mjs --text ""
node src/cli.mjs --help
node src/cli.mjs --version
```

Pipe UTF-8 text into `node src/cli.mjs` (optionally with `--json`).
For example, in a POSIX shell: `printf 'Hello world\n' | node src/cli.mjs --json`.
JSON contains exactly `characters`, `words` and `lines` as numbers.
Plain output labels all three counts.

- **Characters:** Unicode code points, not bytes or grapheme clusters. Emoji
  sequences/combining marks can contain several code points. Newline characters
  count too; CRLF contributes two characters.
- **Words:** nonempty tokens separated by JavaScript whitespace.
- **Lines:** empty input has zero lines. Otherwise split on CRLF or LF,
  counting interior blank lines but excluding one final empty segment when
  input ends in a newline. A lone CR does not separate lines.
  Thus `a\n\nb\n` has three lines, `\n` has one, and `a\r\nb\r\n` has two.

`--text STRING` takes precedence over stdin and never waits for it; an empty
string is valid. Empty piped input is also valid. Interactive stdin without
`--text` is an error. Unknown/positional arguments, missing `--text` values,
duplicate flags and conflicting help/version/data modes fail clearly on stderr
with a nonzero exit code. `--help` and `--version` are standalone modes.

## Check and package

These are verification commands, not a claim that they have already passed:

```sh
node --test
node scripts/runtime-check.mjs
node scripts/package.mjs
```

Packaging uses only Node built-ins, producing
`artifacts/dist/<package-name>-<version>.zip` and `artifacts/dist/SHA256SUMS`.
Use `node scripts/package.mjs --output-dir DIR` for a separate output directory.
It does not run npm, install dependencies or publish anything.

The ZIP stores original bytes at safe relative paths with fixed timestamps and
stable ordering. A reviewed explicit allowlist includes source, package metadata,
this README, acceptance docs, unit/CLI/package tests and runtime/packaging
scripts. CLI tests are included when present (added by the parallel CLI and
runtime acceptance tasks). Files are bounded to 1 MiB each. No directory scanning includes generated
artifacts, secrets, dependencies or Git internals.

Extract with your local ZIP utility into a new empty directory. Files are at the
ZIP root, so run `node src/cli.mjs --help` there directly; no installation is
required. The same test/runtime/package commands above work after extraction.
See [acceptance and hash verification](docs/ACCEPTANCE.md).

Public destination requested: `N0x1/loadstone-text-stats`.
Publication and working repository/release links are pending authorized delivery;
no remote verification is claimed here.
