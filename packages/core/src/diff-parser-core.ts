// Shared browser-safe parsing state machine. Drivers choose whether checkpoints yield to the host.

import type { DiffFile, DiffHunk, ChangeType } from './types';
import {
  MAX_DIFF_DIAGNOSTIC_CHARS,
  createRepresentationBudget,
  resolveSourceBudgets,
  RepresentationLimitError,
  type SourceBudgets,
} from './input-budgets';

export interface DiffParseOptions {
  budgets?: Partial<SourceBudgets>;
}

/**
 * The files parsed, plus one diagnostic per piece of input that could not be represented
 * faithfully.
 */
export interface DiffParseResult {
  files: DiffFile[];
  diagnostics: string[];
}

/**
 * Parse `git diff` output (a/ b/ prefixes, no color). Every hunk is checked
 * against its `@@` counts; a line over them, a short hunk or an unprefixed line
 * is a diagnostic, never context. Empty lines in an open hunk are the one
 * leniency (`git apply` reads them as empty context). Combined output
 * (`diff --cc`) is reported and skipped.
 */
export function* parseDiffSteps(
  rawDiff: string,
  options: DiffParseOptions = {},
  refuse?: (message: string) => never
): Generator<void, DiffParseResult> {
  const budgets = resolveSourceBudgets(options.budgets);
  const representation = createRepresentationBudget(budgets);
  const diagnostics: string[] = [];
  function diagnose(message: string) {
    if (diagnostics.length >= budgets.maxDiagnostics)
      throw new RepresentationLimitError(true, `${budgets.maxDiagnostics}-diagnostic`);
    if (message.length > MAX_DIFF_DIAGNOSTIC_CHARS)
      throw new RepresentationLimitError(true, `${MAX_DIFF_DIAGNOSTIC_CHARS}-character diagnostic`);
    diagnostics.push(message);
  }
  const files: DiffFile[] = [];
  let currentFile: Partial<DiffFile> | null = null;
  let currentHunk: Partial<DiffHunk> | null = null;
  let oldLineNumber = 0;
  let newLineNumber = 0;
  let remainingOld = 0;
  let remainingNew = 0;
  let hasModeChange = false;
  // Inside a binary patch body or an unsupported combined section.
  let skippingSection = false;

  function fileLabel(): string {
    return currentFile?.newPath || currentFile?.oldPath || '<unknown file>';
  }

  function flushHunk(): void {
    if (currentHunk && currentHunk.header && currentFile) {
      if (remainingOld > 0 || remainingNew > 0) {
        diagnose(
          `${fileLabel()}: hunk ${currentHunk.header} ended ${remainingOld} old and ` +
            `${remainingNew} new lines short of its declared counts`
        );
      }
      currentFile.hunks!.push(currentHunk as DiffHunk);
    }
    currentHunk = null;
    remainingOld = 0;
    remainingNew = 0;
  }

  function flushFile(): void {
    flushHunk();
    if (
      currentFile &&
      (currentFile.oldPath || currentFile.newPath) &&
      (currentFile.isBinary ||
        currentFile.hunks!.length > 0 ||
        currentFile.changeType !== 'modified' ||
        hasModeChange ||
        currentFile.omittedReason)
    ) {
      files.push(currentFile as DiffFile);
    }
    currentFile = null;
    hasModeChange = false;
    skippingSection = false;
  }

  for (const line of patchLines(rawDiff)) {
    if (line === null) {
      yield;
      continue;
    }

    try {
      // Start of a new file
      if (line.startsWith('diff --git ')) {
        flushFile();

        representation.beginFile();

        // Extract paths from "diff --git a/<old> b/<new>" as fallback
        // for binary files that lack --- / +++ lines
        const gitPaths = parseGitDiffHeader(line);

        currentFile = {
          oldPath: gitPaths.oldPath,
          newPath: gitPaths.newPath,
          changeType: 'modified' as ChangeType,
          isBinary: false,
          hunks: [],
        };
        continue;
      }

      // Two parents against one result: no DiffFile can carry it.
      const combined = line.match(/^diff --(?:cc|combined) (.*)$/);
      if (combined) {
        flushFile();
        const path = stripPrefix(decodeGitPath(combined[1]));
        diagnose(`${path}: combined (merge conflict) diff output is not supported`);
        skippingSection = true;
        continue;
      }

      if (skippingSection || !currentFile || currentFile.omittedReason) continue;

      // Detect file mode changes
      if (line.startsWith('new file mode')) {
        currentFile.changeType = 'added';
        currentFile.oldPath = '';
        continue;
      }

      if (line.startsWith('deleted file mode')) {
        currentFile.changeType = 'deleted';
        currentFile.newPath = '';
        continue;
      }

      if (line.startsWith('new mode ')) {
        hasModeChange = true;
        continue;
      }

      if (line.startsWith('rename from ')) {
        currentFile.changeType = 'renamed';
        currentFile.oldPath = decodeGitPath(line.substring('rename from '.length));
        continue;
      }

      if (line.startsWith('rename to ')) {
        currentFile.newPath = decodeGitPath(line.substring('rename to '.length));
        continue;
      }

      if (line.startsWith('copy from ')) {
        currentFile.changeType = 'copied';
        currentFile.oldPath = decodeGitPath(line.substring('copy from '.length));
        continue;
      }

      if (line.startsWith('copy to ')) {
        currentFile.newPath = decodeGitPath(line.substring('copy to '.length));
        continue;
      }

      // Parse old file path
      if (!currentHunk && line.startsWith('--- ')) {
        const path = decodeGitPath(line.substring(4).split('\t')[0]);
        currentFile.oldPath = path === '/dev/null' ? '' : stripPrefix(path);
        continue;
      }

      // Parse new file path
      if (!currentHunk && line.startsWith('+++ ')) {
        const path = decodeGitPath(line.substring(4).split('\t')[0]);
        currentFile.newPath = path === '/dev/null' ? '' : stripPrefix(path);
        continue;
      }

      // Detect binary files
      if (line.startsWith('Binary files ')) {
        currentFile.isBinary = true;
        continue;
      }

      // `--binary` emits a base85 body after this marker; skip it.
      if (line === 'GIT binary patch') {
        currentFile.isBinary = true;
        skippingSection = true;
        continue;
      }

      // Parse hunk header
      if (line.startsWith('@@')) {
        flushHunk();

        // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@ context
        const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
        if (!match) {
          diagnose(`${fileLabel()}: unrecognized hunk header "${line}"`);
          continue;
        }
        const oldStart = parseInt(match[1], 10);
        const oldLines = match[2] ? parseInt(match[2], 10) : 1;
        const newStart = parseInt(match[3], 10);
        const newLines = match[4] ? parseInt(match[4], 10) : 1;

        if (
          ![oldStart, oldLines, newStart, newLines, oldStart + oldLines, newStart + newLines].every(
            Number.isSafeInteger
          )
        ) {
          throw new RepresentationLimitError(false, 'safe-integer hunk coordinate');
        }
        if (Math.max(oldLines, newLines) > budgets.maxFileLines) {
          throw new RepresentationLimitError(false, `${budgets.maxFileLines}-line per-file`);
        }
        representation.addHunk();
        currentHunk = {
          header: line,
          oldStart,
          oldLines,
          newStart,
          newLines,
          lines: [],
        };

        oldLineNumber = oldStart;
        newLineNumber = newStart;
        remainingOld = oldLines;
        remainingNew = newLines;
        continue;
      }

      // Before the first hunk: file metadata.
      if (!currentHunk || !currentHunk.lines) continue;

      if (line.startsWith('\\')) {
        continue;
      }

      const marker = line.length === 0 ? ' ' : line[0];
      const content = line.length === 0 ? '' : line.substring(1);

      if (marker === '+') {
        if (remainingNew <= 0) {
          diagnose(
            `${fileLabel()}: line beyond the counts of hunk ${currentHunk.header}: "${line}"`
          );
          continue;
        }
        representation.addLines(1);
        currentHunk.lines.push({
          type: 'addition',
          oldLineNumber: null,
          newLineNumber: newLineNumber,
          content,
        });
        newLineNumber++;
        remainingNew--;
      } else if (marker === '-') {
        if (remainingOld <= 0) {
          diagnose(
            `${fileLabel()}: line beyond the counts of hunk ${currentHunk.header}: "${line}"`
          );
          continue;
        }
        representation.addLines(1);
        currentHunk.lines.push({
          type: 'deletion',
          oldLineNumber: oldLineNumber,
          newLineNumber: null,
          content,
        });
        oldLineNumber++;
        remainingOld--;
      } else if (marker === ' ') {
        if (remainingOld <= 0 || remainingNew <= 0) {
          diagnose(
            `${fileLabel()}: line beyond the counts of hunk ${currentHunk.header}: "${line}"`
          );
          continue;
        }
        representation.addLines(1);
        currentHunk.lines.push({
          type: 'context',
          oldLineNumber: oldLineNumber,
          newLineNumber: newLineNumber,
          content,
        });
        oldLineNumber++;
        newLineNumber++;
        remainingOld--;
        remainingNew--;
      } else {
        diagnose(`${fileLabel()}: unrecognized line inside hunk ${currentHunk.header}: "${line}"`);
      }
    } catch (error) {
      if (!(error instanceof RepresentationLimitError)) throw error;
      refuse?.(error.message);
      // Never retain a partial file as if its hunks were complete.
      currentHunk = null;
      remainingOld = remainingNew = 0;
      if (currentFile) {
        currentFile.hunks = [];
        currentFile.omittedReason = error.message;
      }
      if (error.aggregate) {
        diagnostics.push(`${error.message} Parsing stopped; remaining input was not loaded.`);
        break;
      }
      if (
        diagnostics.length >= budgets.maxDiagnostics ||
        fileLabel().length + error.message.length + 2 > MAX_DIFF_DIAGNOSTIC_CHARS
      ) {
        diagnostics.push(
          'Not loaded: diagnostic representation budget exceeded. Parsing stopped; remaining input was not loaded.'
        );
        break;
      }
      diagnose(`${fileLabel()}: ${error.message}`);
    }
  }

  // Save the last hunk and file
  try {
    flushFile();
  } catch (error) {
    if (!(error instanceof RepresentationLimitError)) throw error;
    refuse?.(error.message);
    if (currentFile) {
      currentFile.hunks = [];
      currentFile.omittedReason = error.message;
    }
    currentHunk = null;
    diagnostics.push(`${error.message} Parsing stopped; remaining input was not loaded.`);
    flushFile();
  }

  return { files, diagnostics };
}

/**
 * Scan bounded pieces without allocating a complete lines array. Null marks a checkpoint after
 * at most 256 lines or a 64 Ki code-unit string slice, including while scanning a single long line.
 * Joining a long line and processing its header/content remain synchronous string operations.
 */
function* patchLines(rawDiff: string): Generator<string | null> {
  const chunkChars = 64 * 1024;
  let parts: string[] = [];
  let linesSinceCheckpoint = 0;
  for (let offset = 0; offset < rawDiff.length; offset += chunkChars) {
    const chunk = rawDiff.slice(offset, offset + chunkChars);
    let start = 0;
    for (;;) {
      const end = chunk.indexOf('\n', start);
      if (end === -1) break;
      const tail = chunk.slice(start, end);
      if (parts.length > 0) {
        parts.push(tail);
        yield parts.join('');
        parts = [];
      } else {
        yield tail;
      }
      start = end + 1;
      if (++linesSinceCheckpoint === 256) {
        yield null;
        linesSinceCheckpoint = 0;
      }
    }
    if (start < chunk.length) parts.push(chunk.slice(start));
    yield null;
    linesSinceCheckpoint = 0;
  }
  // Git's trailing newline terminates the last line; it does not introduce an empty one.
  if (parts.length > 0) yield parts.join('');
}

function stripPrefix(path: string): string {
  // Remove single-character prefix (a/, b/, c/, i/, w/, etc.)
  // Git uses a/b by default, but mnemonicPrefix uses c/i/w/o
  if (path.length > 2 && path[1] === '/') {
    return path.substring(2);
  }
  return path;
}

// `TextDecoder`, not `Buffer`: this parser also runs in the browser (browser.ts).
const OCTAL_PATH_DECODER = new TextDecoder('utf-8');

function decodeGitPath(path: string): string {
  if (!path.startsWith('"') || !path.endsWith('"')) return path;

  const escapes: Record<string, string> = {
    a: '\x07',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
    '"': '"',
    '\\': '\\',
  };
  return path.slice(1, -1).replace(/(?:\\[0-7]{1,3})+|\\[abfnrtv"\\]/g, escape => {
    if (/^\\[0-7]/.test(escape)) {
      // Git quotes UTF-8 bytes as octal, so decode each run together.
      let count = 0;
      for (let i = 0; i < escape.length; i++) if (escape[i] === '\\') count++;
      const bytes = new Uint8Array(count);
      const octals = /\\([0-7]{1,3})/g;
      let match: RegExpExecArray | null;
      let index = 0;
      while ((match = octals.exec(escape)) !== null) bytes[index++] = parseInt(match[1], 8);
      return OCTAL_PATH_DECODER.decode(bytes);
    }
    return escapes[escape[1]];
  });
}

function parseGitDiffHeader(line: string): {
  oldPath: string;
  newPath: string;
} {
  const paths = line.substring('diff --git '.length);
  // Quoted paths are single C-style tokens, even when they contain spaces.
  const quotedOld = paths.match(/^("(?:\\.|[^"\\])*") (.+)$/);
  const quotedNew = paths.match(/^(.+) ("(?:\\.|[^"\\])*")$/);
  const quoted = quotedOld || quotedNew;
  if (quoted) {
    return {
      oldPath: stripPrefix(decodeGitPath(quoted[1])),
      newPath: stripPrefix(decodeGitPath(quoted[2])),
    };
  }

  // Unquoted names can contain spaces. Prefer a boundary whose two paths
  // agree; rename headers supply the exact paths when they differ.
  let boundary: RegExpExecArray | null = null;
  const separators = / [bwico]\//g;
  let match: RegExpExecArray | null;
  while ((match = separators.exec(paths)) !== null) {
    boundary ??= match;
    if (
      stripPrefix(paths.substring(0, match.index)) === stripPrefix(paths.substring(match.index + 1))
    ) {
      boundary = match;
      break;
    }
  }
  if (!boundary) {
    // diff.noprefix: unambiguous only as two bare tokens naming the same path.
    const space = paths.indexOf(' ');
    if (
      space > 0 &&
      space === paths.lastIndexOf(' ') &&
      paths.slice(0, space) === paths.slice(space + 1)
    ) {
      return { oldPath: paths.slice(0, space), newPath: paths.slice(space + 1) };
    }
    return { oldPath: '', newPath: '' };
  }

  return {
    oldPath: stripPrefix(paths.substring(0, boundary.index)),
    newPath: stripPrefix(paths.substring(boundary.index! + 1)),
  };
}
