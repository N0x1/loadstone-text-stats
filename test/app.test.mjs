import test from 'node:test';
import assert from 'node:assert/strict';
import { countText } from '../src/app.mjs';

const cases = [
  ['empty input', '', { characters: 0, words: 0, lines: 0 }],
  ['ordinary text', 'Hello world', { characters: 11, words: 2, lines: 1 }],
  ['Unicode and emoji code points', 'A😀 café', { characters: 7, words: 2, lines: 1 }],
  ['combining marks are separate code points', 'e\u0301 👩‍💻', { characters: 6, words: 2, lines: 1 }],
  ['mixed whitespace', '  one\t two\nthree\u00a0four\r five  ', { characters: 29, words: 5, lines: 2 }],
  ['whitespace only', ' \t\n', { characters: 3, words: 0, lines: 1 }],
  ['CRLF separators', 'one\r\ntwo\r\nthree', { characters: 15, words: 3, lines: 3 }],
  ['final LF adds no line', 'one\ntwo\n', { characters: 8, words: 2, lines: 2 }],
  ['final CRLF adds no line', 'one\r\ntwo\r\n', { characters: 10, words: 2, lines: 2 }],
  ['interior blank lines', 'one\n\ntwo\n', { characters: 9, words: 2, lines: 3 }],
  ['one newline is one blank line', '\n', { characters: 1, words: 0, lines: 1 }],
  ['two newlines are two blank lines', '\n\n', { characters: 2, words: 0, lines: 2 }],
  ['mixed line endings and blank lines', 'a\r\n\nb\n', { characters: 6, words: 2, lines: 3 }],
  ['lone CR does not split lines', 'one\rtwo', { characters: 7, words: 2, lines: 1 }],
];
for (const [name, input, expected] of cases) {
  test(name, () => assert.deepEqual(countText(input), expected));
}

test('rejects non-string input', () => {
  for (const input of [undefined, null, 123, {}, ['text']]) {
    assert.throws(() => countText(input), TypeError);
  }
});
