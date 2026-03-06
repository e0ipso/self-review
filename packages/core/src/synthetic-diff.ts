// src/main/synthetic-diff.ts
// Generates synthetic unified diffs for files that aren't tracked by git.
// Reusable by both git untracked file handling and directory-based scanning.

import { readFileSync } from 'fs';

/**
 * Generate synthetic unified diffs for a list of file paths so they can be
 * parsed by the existing diff parser. Each file is treated as a new addition.
 *
 * @param paths - Relative file paths (e.g. "src/foo.ts")
 * @param rootDir - Absolute path to the root directory containing the files
 * @returns A unified diff string covering all provided files
 */
export function generateSyntheticDiffs(
  paths: string[],
  rootDir: string
): string {
  const diffs: string[] = [];

  for (const filePath of paths) {
    const fullPath = `${rootDir}/${filePath}`;
    let content: Buffer;
    try {
      content = readFileSync(fullPath);
    } catch {
      // File may have been deleted between listing and reading
      continue;
    }

    // Detect binary files by checking for null bytes in the first 8KB
    const sample = content.subarray(0, 8192);
    const isBinary = sample.includes(0);

    if (isBinary) {
      diffs.push(
        `diff --git a/${filePath} b/${filePath}\n` +
          `new file mode 100644\n` +
          `Binary files /dev/null and b/${filePath} differ`
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
      `diff --git a/${filePath} b/${filePath}\n` +
      `new file mode 100644\n` +
      `--- /dev/null\n` +
      `+++ b/${filePath}\n` +
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
