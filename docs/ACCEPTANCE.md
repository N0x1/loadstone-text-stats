# Acceptance and delivery gates

## Intended local checks (Node 22+)

Run from the source root, then repeat from a fresh ZIP extraction:

1. `node --test`: counting edge cases, actual CLI tests, ZIP headers/offsets,
   CRC-32, path rejection, deterministic bytes, allowlist, SHA-256 and unchanged
   source bytes. Packaging tests use isolated temporary directories.
2. `node scripts/runtime-check.mjs`: execute the actual CLI for text, UTF-8 stdin,
   JSON, help/version and invalid arguments. Check packaged source bytes before
   and after; this is separate from unit tests.
3. `node scripts/package.mjs`: build the offline ZIP and `SHA256SUMS`.
4. Verify its digest with built-in Node, from the artifact directory:

```sh
node --input-type=module -e "import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto'; import assert from 'node:assert/strict'; const m=readFileSync('SHA256SUMS','utf8').trim(); const match=/^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*[.]zip)$/.exec(m); assert.ok(match,'Invalid manifest'); assert.equal(createHash('sha256').update(readFileSync(match[2])).digest('hex'),match[1]); console.log('SHA-256 verified');"
```

5. Extract into a fresh empty directory with a ZIP utility; confirm no absolute
   paths or traversal entries, then run `node src/cli.mjs --text "Hello 😀" --json`,
   expecting `{"characters":7,"words":2,"lines":1}`. Run help, version, tests
   and runtime checks from that extraction without npm install.
6. Confirm the original allowlisted files remain byte-for-byte unchanged after
   runtime checks and packaging, and that only intended files are in the ZIP.

The manifest hashes the ZIP itself. CRC-32 validates individual ZIP entries;
SHA-256 detects artifact changes, but neither authenticates an untrusted sender.
Repackaging the same inputs produces the same ZIP bytes. The manifest and ZIP
stay outside the packaged inputs. The CLI and text-argument regression test
files are optional allowlist entries until their owning tasks are integrated;
final delivery must include both and the completed runtime checks.

## Product contract

Characters count Unicode code points; words are nonempty whitespace-separated
tokens. Empty text returns all zeros. Split nonempty input on CRLF or LF and
remove one terminal empty segment: interior blank lines count and a trailing
newline adds no line. Lone CR is not a separator. JSON exposes exactly the
three numeric keys; errors go to stderr with a nonzero exit status.
See the README for flags, stdin precedence and usage.

## Evidence status

At documentation preparation, local unit checks, runtime checks, ZIP extraction,
hash verification and unchanged-source checks are **pending Foreman execution
and lead review**. No executed test results or Node runtime compatibility evidence
are asserted by these instructions. The starter checks are not product evidence.

Before delivery, record actual Node version, commands/results, artifact filename
and SHA-256, extraction results and immutability results in the review record.
Keep compilation/syntax checks, unit checks, black-box runtime checks, artifact
verification and remote delivery evidence distinct.

## Authorized public delivery

Foreman handles publication only after authorization and review/merge approval.
Requested public destination: `N0x1/loadstone-text-stats`. Upload reviewed source,
documentation, runnable ZIP and hash manifest; verify public remote contents,
downloaded artifact hash and working repository/release links. Local success
does not prove publication, link availability or remote integrity. No repository
or release URL is asserted until verified delivery evidence exists.
