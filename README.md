# Text Stats

Count characters, words and lines from a string or a text file. Text Stats runs locally and gives you either a readable summary or JSON for a script.

**Requires Node.js 22 or later.** No packages to install.

## Quick start

Download the ZIP from [Releases](https://github.com/N0x1/text-stats/releases), extract it, and open a terminal in that folder.

```sh
node src/cli.mjs --text "Hello world" --json
```

```json
{"characters":11,"words":2,"lines":1}
```

Leave off `--json` for a readable summary. To count a file, pipe its UTF-8 contents into the command or redirect standard input:

```sh
node src/cli.mjs --json < notes.txt
```

The redirection example works in Command Prompt, bash and zsh. In PowerShell, use `cmd /c "node src/cli.mjs --json < notes.txt"` to pass the file's bytes directly to the command.

## Options

| Option | What it does |
| --- | --- |
| `--text STRING` | Count the supplied string instead of reading standard input. |
| `--json` | Return numeric `characters`, `words` and `lines` fields. |
| `--help` | Show usage and counting rules. |
| `--version` | Print the installed version. |

## Counting rules

- **Characters** are Unicode code points, including spaces and line breaks. Some visible symbols contain more than one code point.
- **Words** are nonempty groups separated by whitespace.
- **Lines** split on LF or CRLF. A final newline does not add an extra line; interior blank lines do count. Empty text returns zero for all three counts.

For example, `Hello 😀` has 7 characters, 2 words and 1 line. CRLF contributes two characters but one line break.

An empty string is valid: `--text ""`. A value after `--text` is always treated as text, even if it starts with `--`. Invalid or repeated options produce a message on standard error and a nonzero exit code. Use `--help` and `--version` on their own.

## Development

```sh
node --test
node scripts/runtime-check.mjs
```

See the [development guide](docs/ACCEPTANCE.md) for packaging and verification.
