// packages/core/src/synthetic-diff.ts
// Generates synthetic unified diffs for files that aren't tracked by git.
// Reusable by both git untracked file handling and directory-based scanning.
//
// Reads are bounded first (input-budgets.ts). A file over budget is still listed, with no
// content and an `omittedReason`, and named in the diagnostics.

import { realpathSync } from 'fs';
import { join, resolve } from 'path';
import type { DiffFile } from './types';
import { parseDiffWithDiagnostics } from './diff-parser';
import { readSyntheticSource, readSyntheticSourceAsync } from './synthetic-source';
import type { SyntheticSource } from './synthetic-source';
import { checkLoadingCancelled, loadingCheckpoint } from './local-loading-lifetime';
export { readSyntheticSource } from './synthetic-source';
export type { SyntheticSource } from './synthetic-source';
import { formatBytes, resolveSourceBudgets, type SourceBudgets } from './input-budgets';

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

export interface SyntheticDiffOptions {
  /**
   * Only for a path the reviewer named explicitly (single-file review); enumerated paths never
   * follow links.
   */
  followSymlinks?: boolean;
  budgets?: Partial<SourceBudgets>;
}

export interface SyntheticDiffResult {
  diff: string;
  /**
   * Files listed without content, by literal relative path, with the sentence the viewer shows
   * instead.
   */
  omitted: Map<string, string>;
  diagnostics: string[];
}

/**
 * Generate synthetic unified diffs for a list of file paths so they can be
 * parsed by the existing diff parser. Each file is treated as a new addition.
 *
 * @param paths - Literal relative file paths (e.g. "src/foo.ts"), resolved
 *   against rootDir and never git-quoted on the way in
 * @param rootDir - Absolute path to the root directory the paths are relative to
 * @returns The diff text, the files listed without content, and diagnostics
 */
export function generateSyntheticDiffs(
  paths: string[],
  rootDir: string,
  options: SyntheticDiffOptions = {}
): SyntheticDiffResult {
  const budgets = resolveSourceBudgets(options.budgets);
  const sourceRoot = syntheticRoot(rootDir);
  const projection = createProjection(budgets);
  for (const filePath of paths) {
    projection.add(
      filePath,
      projection.exhausted()
        ? null
        : readSyntheticSource(join(sourceRoot, filePath), {
            sourceRoot,
            followSymlinks: options.followSymlinks,
            maxFileBytes: budgets.maxFileBytes,
            remainingBytes: projection.remaining(),
          })
    );
  }
  return projection.finish();
}

export interface AsyncSyntheticDiffOptions extends SyntheticDiffOptions {
  signal?: AbortSignal;
}

/** Async counterpart with the same ordering, budgets and projection as generateSyntheticDiffs. */
export async function generateSyntheticDiffsAsync(
  paths: string[],
  rootDir: string,
  options: AsyncSyntheticDiffOptions = {}
): Promise<SyntheticDiffResult> {
  checkLoadingCancelled(options.signal);
  const budgets = resolveSourceBudgets(options.budgets);
  const sourceRoot = syntheticRoot(rootDir);
  const projection = createProjection(budgets);
  for (const filePath of paths) {
    await loadingCheckpoint(options.signal);
    const source = projection.exhausted()
      ? null
      : await readSyntheticSourceAsync(join(sourceRoot, filePath), {
          sourceRoot,
          followSymlinks: options.followSymlinks,
          maxFileBytes: budgets.maxFileBytes,
          remainingBytes: projection.remaining(),
          signal: options.signal,
        });
    checkLoadingCancelled(options.signal);
    projection.add(filePath, source);
  }
  await loadingCheckpoint(options.signal);
  return projection.finish();
}

function syntheticRoot(rootDir: string): string {
  try {
    return realpathSync(rootDir);
  } catch {
    // Preserve per-path disappearance diagnostics when a root vanishes before the read.
    return resolve(rootDir);
  }
}

/** The shared, I/O-free projection owns aggregate accounting and all omission diagnostics. */
function createProjection(budgets: SourceBudgets) {
  const diffs: string[] = [];
  const omitted = new Map<string, string>();
  const tooLarge: string[] = [];
  const overTotal: string[] = [];
  const unreadable: string[] = [];
  let totalRead = 0;
  let totalExhausted = false;

  function add(filePath: string, source: SyntheticSource | null): void {
    // Git quotes the prefixed path as a whole ("a/name"), not the name alone.
    const oldHeaderPath = quoteGitPath(`a/${filePath}`);
    const newHeaderPath = quoteGitPath(`b/${filePath}`);
    const header = `diff --git ${oldHeaderPath} ${newHeaderPath}\n`;

    if (source === null) {
      // Nothing more is read once the aggregate is spent: the cut is one point in the list.
      overTotal.push(filePath);
      omitted.set(filePath, overTotalReason(budgets.maxTotalBytes));
      diffs.push(`${header}new file mode 100644`);
      return;
    }

    totalRead += source.bytesRead;

    switch (source.kind) {
      case 'skip':
        return;
      case 'unreadable':
        unreadable.push(`${filePath} (${source.code})`);
        return;
      case 'binary':
        diffs.push(
          `${header}new file mode 100644\n` + `Binary files /dev/null and ${newHeaderPath} differ`
        );
        return;
      case 'too-large':
        tooLarge.push(filePath);
        omitted.set(
          filePath,
          `Not loaded: this file is ${formatBytes(source.size)}, over the ` +
            `${formatBytes(budgets.maxFileBytes)} per-file read budget.`
        );
        diffs.push(`${header}new file mode 100644`);
        return;
      case 'over-total':
        totalExhausted = true;
        overTotal.push(filePath);
        omitted.set(filePath, overTotalReason(budgets.maxTotalBytes));
        diffs.push(`${header}new file mode 100644`);
        return;
      case 'symlink':
        diffs.push(addedTextDiff(header, newHeaderPath, '120000', source.content));
        return;
      case 'text':
        diffs.push(addedTextDiff(header, newHeaderPath, '100644', source.content));
        return;
    }
  }

  function finish(): SyntheticDiffResult {
    const diagnostics: string[] = [];
    if (tooLarge.length > 0) {
      diagnostics.push(
        `${countFiles(tooLarge.length)} over the ${formatBytes(budgets.maxFileBytes)} per-file ` +
          `read budget ${tooLarge.length === 1 ? 'is' : 'are'} listed without content: ` +
          listPaths(tooLarge)
      );
    }
    if (overTotal.length > 0) {
      diagnostics.push(
        `The ${formatBytes(budgets.maxTotalBytes)} total read budget for this review ran out; ` +
          `${countFiles(overTotal.length)} ${overTotal.length === 1 ? 'is' : 'are'} listed ` +
          `without content: ${listPaths(overTotal)}`
      );
    }
    if (unreadable.length > 0) {
      diagnostics.push(
        `${countFiles(unreadable.length)} could not be read and ` +
          `${unreadable.length === 1 ? 'is' : 'are'} not shown: ${listPaths(unreadable)}`
      );
    }

    return { diff: diffs.join('\n'), omitted, diagnostics };
  }
  return {
    add,
    finish,
    remaining: () => budgets.maxTotalBytes - totalRead,
    exhausted: () => totalExhausted,
  };
}

/** Builds and parses in one step, setting `omittedReason` on files listed without content. */
export function loadSyntheticFiles(
  paths: string[],
  rootDir: string,
  options: SyntheticDiffOptions = {}
): { files: DiffFile[]; diagnostics: string[] } {
  return parseSyntheticDiffs(generateSyntheticDiffs(paths, rootDir, options));
}

/** Async build; cancellation never returns a partial set of files. */
export async function loadSyntheticFilesAsync(
  paths: string[],
  rootDir: string,
  options: AsyncSyntheticDiffOptions = {}
): Promise<{ files: DiffFile[]; diagnostics: string[] }> {
  const result = await generateSyntheticDiffsAsync(paths, rootDir, options);
  checkLoadingCancelled(options.signal);
  const parsed = parseSyntheticDiffs(result);
  await loadingCheckpoint(options.signal);
  return parsed;
}

function parseSyntheticDiffs({ diff, omitted, diagnostics }: SyntheticDiffResult): {
  files: DiffFile[];
  diagnostics: string[];
} {
  const parsed = parseDiffWithDiagnostics(diff);
  for (const file of parsed.files) {
    const reason = omitted.get(file.newPath);
    if (reason !== undefined) file.omittedReason = reason;
  }
  return { files: parsed.files, diagnostics: [...diagnostics, ...parsed.diagnostics] };
}

function addedTextDiff(
  header: string,
  newHeaderPath: string,
  mode: string,
  content: Buffer
): string {
  const text = content.toString('utf-8');
  const lines = text.split('\n');

  // Remove trailing empty string from split if file ends with newline
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const lineCount = lines.length;
  const addedLines = lines.map(line => `+${line}`).join('\n');

  let diff =
    header +
    `new file mode ${mode}\n` +
    `--- /dev/null\n` +
    `+++ ${newHeaderPath}\n` +
    `@@ -0,0 +1,${lineCount} @@\n` +
    addedLines;

  // Indicate missing newline at end of file
  if (text.length > 0 && !text.endsWith('\n')) {
    diff += '\n\\ No newline at end of file';
  }
  return diff;
}

function overTotalReason(maxTotalBytes: number): string {
  return (
    `Not loaded: the ${formatBytes(maxTotalBytes)} total read budget for this review ` +
    'ran out before this file.'
  );
}

const LISTED_PATHS = 10;

function listPaths(paths: string[]): string {
  const shown = paths.slice(0, LISTED_PATHS).join(', ');
  const rest = paths.length - LISTED_PATHS;
  return rest > 0 ? `${shown}, and ${rest} more` : shown;
}

function countFiles(count: number): string {
  return `${count} ${count === 1 ? 'file' : 'files'}`;
}
