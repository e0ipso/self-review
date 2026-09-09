// packages/core/src/synthetic-diff.ts
// Generates synthetic unified diffs for files that aren't tracked by git.
// Reusable by both git untracked file handling and directory-based scanning.

import { readFileSync } from 'fs';
import { join } from 'path';

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

/**
 * Generate synthetic unified diffs for a list of file paths so they can be
 * parsed by the existing diff parser. Each file is treated as a new addition.
 *
 * @param paths - Literal relative file paths (e.g. "src/foo.ts"), resolved
 *   against rootDir and never git-quoted on the way in
 * @param rootDir - Absolute path to the root directory the paths are relative to
 * @returns A unified diff string covering all provided files
 */
export function generateSyntheticDiffs(paths: string[], rootDir: string): string {
  const diffs: string[] = [];

  for (const filePath of paths) {
    const fullPath = join(rootDir, filePath);
    let content: Buffer;
    try {
      content = readFileSync(fullPath);
    } catch {
      // File may have been deleted between listing and reading
      continue;
    }

    // Git quotes the prefixed path as a whole ("a/name"), not the name alone.
    const oldHeaderPath = quoteGitPath(`a/${filePath}`);
    const newHeaderPath = quoteGitPath(`b/${filePath}`);

    // Detect binary files by checking for null bytes in the first 8KB
    const sample = content.subarray(0, 8192);
    const isBinary = sample.includes(0);

    if (isBinary) {
      diffs.push(
        `diff --git ${oldHeaderPath} ${newHeaderPath}\n` +
          `new file mode 100644\n` +
          `Binary files /dev/null and ${newHeaderPath} differ`
      );
      continue;
    }

    const text = content.toString('utf-8');
    const lines = text.split('\n');

    // Remove trailing empty string from split if file ends with newline
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    const lineCount = lines.length;
    const addedLines = lines.map(line => `+${line}`).join('\n');

    let diff =
      `diff --git ${oldHeaderPath} ${newHeaderPath}\n` +
      `new file mode 100644\n` +
      `--- /dev/null\n` +
      `+++ ${newHeaderPath}\n` +
      `@@ -0,0 +1,${lineCount} @@\n` +
      addedLines;

    // Indicate missing newline at end of file
    if (text.length > 0 && !text.endsWith('\n')) {
      diff += '\n\\ No newline at end of file';
    }

    diffs.push(diff);
  }

  return diffs.join('\n');
}
