// packages/core/src/diff-parser.ts
// Parse unified diff output into DiffFile[]

import { DiffFile, DiffHunk, ChangeType } from './types';

/**
 * The files parsed, plus one diagnostic per piece of input that could not be represented
 * faithfully.
 */
export interface DiffParseResult {
  files: DiffFile[];
  diagnostics: string[];
}

/** Parse a unified diff, discarding diagnostics. Prefer {@link parseDiffWithDiagnostics}. */
export function parseDiff(rawDiff: string): DiffFile[] {
  return parseDiffWithDiagnostics(rawDiff).files;
}

/**
 * Parse `git diff` output (a/ b/ prefixes, no color). Every hunk is checked
 * against its `@@` counts; a line over them, a short hunk or an unprefixed line
 * is a diagnostic, never context. Empty lines in an open hunk are the one
 * leniency (`git apply` reads them as empty context). Combined output
 * (`diff --cc`) is reported and skipped.
 */
export function parseDiffWithDiagnostics(rawDiff: string): DiffParseResult {
  const diagnostics: string[] = [];
  if (!rawDiff.trim()) {
    return { files: [], diagnostics };
  }

  const lines = rawDiff.split('\n');
  // The empty element after git's final newline is not a line of the last hunk.
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
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
        diagnostics.push(
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
        hasModeChange)
    ) {
      files.push(currentFile as DiffFile);
    }
    currentFile = null;
    hasModeChange = false;
    skippingSection = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start of a new file
    if (line.startsWith('diff --git ')) {
      flushFile();

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
      diagnostics.push(`${path}: combined (merge conflict) diff output is not supported`);
      skippingSection = true;
      continue;
    }

    if (skippingSection || !currentFile) continue;

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
        diagnostics.push(`${fileLabel()}: unrecognized hunk header "${line}"`);
        continue;
      }
      const oldStart = parseInt(match[1], 10);
      const oldLines = match[2] ? parseInt(match[2], 10) : 1;
      const newStart = parseInt(match[3], 10);
      const newLines = match[4] ? parseInt(match[4], 10) : 1;

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
        diagnostics.push(
          `${fileLabel()}: line beyond the counts of hunk ${currentHunk.header}: "${line}"`
        );
        continue;
      }
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
        diagnostics.push(
          `${fileLabel()}: line beyond the counts of hunk ${currentHunk.header}: "${line}"`
        );
        continue;
      }
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
        diagnostics.push(
          `${fileLabel()}: line beyond the counts of hunk ${currentHunk.header}: "${line}"`
        );
        continue;
      }
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
      diagnostics.push(
        `${fileLabel()}: unrecognized line inside hunk ${currentHunk.header}: "${line}"`
      );
    }
  }

  // Save the last hunk and file
  flushFile();

  return { files, diagnostics };
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
      const bytes = escape
        .slice(1)
        .split('\\')
        .map(byte => parseInt(byte, 8));
      return OCTAL_PATH_DECODER.decode(Uint8Array.from(bytes));
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
  const separators = [...paths.matchAll(/ [bwico]\//g)];
  const boundary =
    separators.find(
      match =>
        stripPrefix(paths.substring(0, match.index)) ===
        stripPrefix(paths.substring(match.index! + 1))
    ) || separators[0];
  if (!boundary) {
    // diff.noprefix: unambiguous only as two bare tokens naming the same path.
    const bare = paths.split(' ');
    if (bare.length === 2 && bare[0] === bare[1]) {
      return { oldPath: bare[0], newPath: bare[1] };
    }
    return { oldPath: '', newPath: '' };
  }

  return {
    oldPath: stripPrefix(paths.substring(0, boundary.index)),
    newPath: stripPrefix(paths.substring(boundary.index! + 1)),
  };
}
