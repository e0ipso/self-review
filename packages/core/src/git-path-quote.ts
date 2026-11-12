// Git-compatible path encoding shared by synthetic emitters.
// C-style escapes git emits for the characters that have one.
const C_STYLE_ESCAPES: Record<number, string> = {
  0x07: '\\a',
  0x08: '\\b',
  0x09: '\\t',
  0x0a: '\\n',
  0x0b: '\\v',
  0x0c: '\\f',
  0x0d: '\\r',
  0x22: '\\"',
  0x5c: '\\\\',
};

function needsQuoting(byte: number): boolean {
  return byte < 0x20 || byte >= 0x7f || byte === 0x22 || byte === 0x5c;
}

/**
 * Encode a path the way git writes it in diff headers. A plain path goes out
 * verbatim. Anything else becomes a double-quoted C-style token with control
 * characters, quotes, backslashes and non-ASCII UTF-8 bytes escaped.
 *
 * This inverts `decodeGitPath` in diff-parser.ts. Without it, a filename
 * containing a newline ends the header line mid-name and the parser recovers
 * a name no file on disk answers to.
 */
export function quoteGitPath(path: string): string {
  const bytes = Buffer.from(path, 'utf-8');
  if (!bytes.some(needsQuoting)) return path;

  let quoted = '"';
  for (const byte of bytes) {
    const escape = C_STYLE_ESCAPES[byte];
    if (escape) {
      quoted += escape;
    } else if (byte < 0x20 || byte >= 0x7f) {
      quoted += `\\${byte.toString(8).padStart(3, '0')}`;
    } else {
      quoted += String.fromCharCode(byte);
    }
  }
  return `${quoted}"`;
}
