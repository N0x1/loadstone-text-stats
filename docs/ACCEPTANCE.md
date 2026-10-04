# Development

Use Node.js 22 or later. The project uses built-in modules and does not need a dependency install.

## Run the checks

From the project directory:

```sh
node --test
node scripts/runtime-check.mjs
```

The test suite covers the calculation rules, command-line behavior and archive builder. The runtime check starts the actual CLI and checks its output. It also verifies that running the CLI leaves packaged source files unchanged.

Some archive tests need permission to create symbolic links. Node reports those cases as skipped when the host denies that permission; a skipped case has not been tested.

## Build a ZIP

```sh
node scripts/package.mjs
```

This creates `artifacts/dist/text-stats-0.1.1.zip` and `artifacts/dist/SHA256SUMS`. The archive contains the files listed in the packaging script, including source, documentation and tests. Rebuilding unchanged inputs produces the same bytes.

To test a package, extract it into a new empty directory and run the two check commands there. Then try the Quick start example from the README. No installation step is needed.

## Verify a download

GitHub releases include the runnable ZIP and a separate JSON manifest containing SHA-256 file and archive hashes. Compare the downloaded ZIP's SHA-256 with the value recorded in its manifest. Locally built ZIPs use the checksum file above.

On PowerShell:

```powershell
Get-FileHash .\source-and-runnable.zip -Algorithm SHA256
```

On macOS, use `shasum -a 256 source-and-runnable.zip`; on Linux, use `sha256sum source-and-runnable.zip`. Matching hashes show that the files match the recorded download. They do not establish who created a file.
