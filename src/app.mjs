/**
 * Count Unicode code points, whitespace-separated words, and CRLF/LF lines.
 * A final newline terminates the last line rather than adding another one.
 * Interior blank lines count; a lone CR is whitespace, not a line separator.
 */
export function countText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('countText requires a string');
  }
  if (text.length === 0) {
    return { characters: 0, words: 0, lines: 0 };
  }
  const lines = text.split(/\r\n|\n/);
  if (lines.at(-1) === '') lines.pop();
  return {
    characters: Array.from(text).length,
    words: (text.match(/\S+/gu) ?? []).length,
    lines: lines.length,
  };
}
