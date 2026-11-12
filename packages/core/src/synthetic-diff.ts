// packages/core/src/synthetic-diff.ts
// Generates synthetic unified diffs for files that aren't tracked by git.
// Reusable by both git untracked file handling and directory-based scanning.
//
// Reads are bounded first (input-budgets.ts). A file over budget is still listed, with no
// content and an `omittedReason`, and named in the diagnostics.

import { realpathSync } from 'fs';
import { join, resolve } from 'path';
import type { DiffFile, DiffLine } from './types';
import { readSyntheticSource, readSyntheticSourceAsync } from './synthetic-source';
import type { SyntheticSource } from './synthetic-source';
import { checkLoadingCancelled, loadingCheckpoint } from './local-loading-lifetime';
export { readSyntheticSource } from './synthetic-source';
export type { SyntheticSource } from './synthetic-source';
import {
  formatBytes,
  resolveSourceBudgets,
  createRepresentationBudget,
  RepresentationLimitError,
  type SourceBudgets,
  type ResolvedSourceBudgets,
} from './input-budgets';

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
  const { diff, omitted, diagnostics } = projectSources(paths, rootDir, options, 'patch');
  return { diff, omitted, diagnostics };
}

function projectSources(
  paths: string[],
  rootDir: string,
  options: SyntheticDiffOptions,
  output: 'patch' | 'files'
) {
  const budgets = resolveSourceBudgets(options.budgets);
  const sourceRoot = syntheticRoot(rootDir);
  const projection = createProjection(budgets, output);
  for (const filePath of paths) {
    if (!projection.beginFile()) break;
    const steps = projection.add(
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
    while (!steps.next().done) {
      /* Synchronous compatibility consumer. */
    }
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
  const { diff, omitted, diagnostics } = await projectSourcesAsync(
    paths,
    rootDir,
    options,
    'patch'
  );
  return { diff, omitted, diagnostics };
}

async function projectSourcesAsync(
  paths: string[],
  rootDir: string,
  options: AsyncSyntheticDiffOptions,
  output: 'patch' | 'files'
) {
  checkLoadingCancelled(options.signal);
  const budgets = resolveSourceBudgets(options.budgets);
  const sourceRoot = syntheticRoot(rootDir);
  const projection = createProjection(budgets, output);
  for (const filePath of paths) {
    await loadingCheckpoint(options.signal);
    if (!projection.beginFile()) break;
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
    const steps = projection.add(filePath, source);
    try {
      while (!steps.next().done) await loadingCheckpoint(options.signal);
    } finally {
      steps.return(undefined);
    }
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
function createProjection(budgets: ResolvedSourceBudgets, output: 'patch' | 'files') {
  const representation = createRepresentationBudget(budgets);
  let representationExhausted: string | undefined;
  const representationOmissions: string[] = [];
  const diffs: string[] = [];
  const files: DiffFile[] = [];
  const omitted = new Map<string, string>();
  const projectionDiagnostics: string[] = [];
  let emptyBeforeNextFile: string | undefined;
  const tooLarge: string[] = [];
  const overTotal: string[] = [];
  const unreadable: string[] = [];
  let totalRead = 0;
  let totalExhausted = false;

  function* emit(
    filePath: string,
    source?: Extract<SyntheticSource, { kind: 'text' | 'symlink' | 'binary' }>,
    mode = source?.kind === 'symlink' ? '120000' : '100644'
  ): Generator<void> {
    // The textual format leaves an empty line after a zero-line hunk when another file
    // follows. Preserve its existing parser diagnostic without reparsing the patch.
    const text =
      source && source.kind !== 'binary'
        ? yield* projectText(source.content, representation)
        : undefined;
    if (text) representation.addHunk();
    if (emptyBeforeNextFile !== undefined) {
      if (projectionDiagnostics.length < budgets.maxDiagnostics)
        projectionDiagnostics.push(
          `${emptyBeforeNextFile}: line beyond the counts of hunk @@ -0,0 +1,0 @@: ""`
        );
      else if (projectionDiagnostics.length === budgets.maxDiagnostics)
        projectionDiagnostics.push(
          'Further synthetic separator diagnostics omitted: diagnostic representation budget exceeded.'
        );
    }
    emptyBeforeNextFile = text?.lineCount === 0 ? filePath : undefined;
    const lines: DiffLine[] = [];
    const patch: string[] = [];
    if (text) {
      let start = 0;
      for (let index = 0; index < text.lineCount; index++) {
        const end = text.text.indexOf('\n', start);
        const content = text.text.slice(start, end === -1 ? undefined : end);
        start = end + 1;
        if (output === 'files') {
          lines.push({ type: 'addition', oldLineNumber: null, newLineNumber: index + 1, content });
        } else {
          patch.push(`+${content}`);
        }
        if ((index + 1) % 256 === 0) yield;
      }
    }
    if (output === 'files') {
      files.push({
        oldPath: '',
        newPath: filePath,
        changeType: 'added',
        isBinary: source?.kind === 'binary',
        hunks: text
          ? [
              {
                header: text.header,
                oldStart: 0,
                oldLines: 0,
                newStart: 1,
                newLines: text.lineCount,
                lines,
              },
            ]
          : [],
      });
      return;
    }
    // Git quotes the prefixed path as a whole ("a/name"), not the name alone.
    const oldHeaderPath = quoteGitPath(`a/${filePath}`);
    const newHeaderPath = quoteGitPath(`b/${filePath}`);
    const header = `diff --git ${oldHeaderPath} ${newHeaderPath}\nnew file mode ${mode}`;
    diffs.push(
      text
        ? `${header}\n--- /dev/null\n+++ ${newHeaderPath}\n${text.header}\n` +
            patch.join('\n') +
            (text.missingNewline ? '\n\\ No newline at end of file' : '')
        : source?.kind === 'binary'
          ? `${header}\nBinary files /dev/null and ${newHeaderPath} differ`
          : header
    );
  }

  function* addSource(filePath: string, source: SyntheticSource | null): Generator<void> {
    if (representationExhausted) {
      representationOmissions.push(filePath);
      omitted.set(filePath, representationExhausted);
      yield* emit(filePath);
      return;
    }
    if (source === null) {
      // Nothing more is read once the aggregate is spent: the cut is one point in the list.
      overTotal.push(filePath);
      omitted.set(filePath, overTotalReason(budgets.maxTotalBytes));
      yield* emit(filePath);
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
        yield* emit(filePath, source);
        return;
      case 'too-large':
        tooLarge.push(filePath);
        omitted.set(
          filePath,
          `Not loaded: this file is ${formatBytes(source.size)}, over the ` +
            `${formatBytes(budgets.maxFileBytes)} per-file read budget.`
        );
        yield* emit(filePath);
        return;
      case 'over-total':
        totalExhausted = true;
        overTotal.push(filePath);
        omitted.set(filePath, overTotalReason(budgets.maxTotalBytes));
        yield* emit(filePath);
        return;
      case 'symlink':
      case 'text':
        yield* emit(filePath, source);
        return;
    }
  }

  function* add(filePath: string, source: SyntheticSource | null): Generator<void> {
    try {
      yield* addSource(filePath, source);
    } catch (error) {
      if (!(error instanceof RepresentationLimitError)) throw error;
      if (error.aggregate) representationExhausted = error.message;
      representationOmissions.push(filePath);
      omitted.set(filePath, error.message);
      yield* emit(filePath, undefined, source?.kind === 'symlink' ? '120000' : '100644');
    }
  }

  function finish() {
    const diagnostics: string[] = [];
    if (representationOmissions.length > 0) {
      diagnostics.push(
        `${countFiles(representationOmissions.length)} listed without content because a representation budget ran out: ${listPaths(representationOmissions)}`
      );
    }
    if (representationExhausted) diagnostics.push(representationExhausted);
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

    for (const file of files) {
      const reason = omitted.get(file.newPath);
      if (reason !== undefined) file.omittedReason = reason;
    }
    return {
      diff: diffs.join('\n'),
      files,
      omitted,
      diagnostics: output === 'files' ? [...diagnostics, ...projectionDiagnostics] : diagnostics,
    };
  }
  return {
    beginFile: () => {
      try {
        representation.beginFile();
        return true;
      } catch (error) {
        if (!(error instanceof RepresentationLimitError)) throw error;
        representationExhausted = `${error.message} Loading stopped; remaining paths were not loaded.`;
        return false;
      }
    },
    add,
    finish,
    remaining: () => budgets.maxTotalBytes - totalRead,
    exhausted: () => totalExhausted || representationExhausted !== undefined,
  };
}

/** Build structured additions directly, with the same projection and budgets as patch output. */
export function loadSyntheticFiles(
  paths: string[],
  rootDir: string,
  options: SyntheticDiffOptions = {}
): { files: DiffFile[]; diagnostics: string[] } {
  const { files, diagnostics } = projectSources(paths, rootDir, options, 'files');
  return { files, diagnostics };
}

/** Async build; cancellation never returns a partial set of files. */
export async function loadSyntheticFilesAsync(
  paths: string[],
  rootDir: string,
  options: AsyncSyntheticDiffOptions = {}
): Promise<{ files: DiffFile[]; diagnostics: string[] }> {
  const { files, diagnostics } = await projectSourcesAsync(paths, rootDir, options, 'files');
  return { files, diagnostics };
}

/** Decode once for either output; retain CR, BOM and UTF-8 replacement semantics. */
function* projectText(
  content: Buffer,
  representation: ReturnType<typeof createRepresentationBudget>
) {
  let lineCount = 0;
  // Count before decoding or allocating any line strings/objects. A byte chunk also bounds
  // checkpoint spacing for a single long line. UTF-8 never embeds LF in a multibyte sequence.
  for (let start = 0; start < content.length; start += 64 * 1024) {
    let count = 0;
    const end = Math.min(start + 64 * 1024, content.length);
    for (let i = start; i < end; i++) if (content[i] === 0x0a) count++;
    representation.addLines(count);
    lineCount += count;
    yield;
  }
  const missingNewline = content.length > 0 && content[content.length - 1] !== 0x0a;
  if (missingNewline) {
    representation.addLines(1);
    lineCount++;
  }
  return {
    text: content.toString('utf-8'),
    lineCount,
    header: `@@ -0,0 +1,${lineCount} @@`,
    missingNewline,
  };
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
