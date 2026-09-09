// src/main/diff-parser.ts
// Parse unified diff output into DiffFile[]

import { DiffFile, DiffHunk, ChangeType } from './types';

export function parseDiff(rawDiff: string): DiffFile[] {
  if (!rawDiff.trim()) {
    return [];
  }

  const lines = rawDiff.split('\n');
  const files: DiffFile[] = [];
  let currentFile: Partial<DiffFile> | null = null;
  let currentHunk: Partial<DiffHunk> | null = null;
  let oldLineNumber = 0;
  let newLineNumber = 0;
  let hasModeChange = false;

  function flushFile(): void {
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
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start of a new file
    if (line.startsWith('diff --git ')) {
      // Flush the pending hunk into the current file before saving
      if (currentHunk && currentHunk.header && currentFile) {
        currentFile.hunks!.push(currentHunk as DiffHunk);
        currentHunk = null;
      }

      flushFile();

      // Extract paths from "diff --git a/<old> b/<new>" as fallback
      // for binary files that lack --- / +++ lines
      const gitPaths = parseGitDiffHeader(line);

      // Initialize new file
      currentFile = {
        oldPath: gitPaths.oldPath,
        newPath: gitPaths.newPath,
        changeType: 'modified' as ChangeType,
        isBinary: false,
        hunks: [],
      };
      currentHunk = null;
      hasModeChange = false;
      continue;
    }

    if (!currentFile) continue;

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

    // Parse hunk header
    if (line.startsWith('@@')) {
      // Save previous hunk if exists
      if (currentHunk && currentHunk.header) {
        currentFile.hunks!.push(currentHunk as DiffHunk);
      }

      // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@ context
      const match = line.match(
        /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/
      );
      if (match) {
        const oldStart = parseInt(match[1], 10);
        const oldLines = match[2] ? parseInt(match[2], 10) : 1;
        const newStart = parseInt(match[3], 10);
        const newLines = match[4] ? parseInt(match[4], 10) : 1;
        const _context = match[5];

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
      }
      continue;
    }

    // Parse diff lines (must have a current hunk)
    if (currentHunk && currentHunk.lines) {
      if (line.startsWith('+')) {
        // Addition
        currentHunk.lines.push({
          type: 'addition',
          oldLineNumber: null,
          newLineNumber: newLineNumber,
          content: line.substring(1),
        });
        newLineNumber++;
      } else if (line.startsWith('-')) {
        // Deletion
        currentHunk.lines.push({
          type: 'deletion',
          oldLineNumber: oldLineNumber,
          newLineNumber: null,
          content: line.substring(1),
        });
        oldLineNumber++;
      } else if (line.startsWith(' ')) {
        // Context line
        currentHunk.lines.push({
          type: 'context',
          oldLineNumber: oldLineNumber,
          newLineNumber: newLineNumber,
          content: line.substring(1),
        });
        oldLineNumber++;
        newLineNumber++;
      } else if (line.startsWith('\\')) {
        // "\ No newline at end of file" - ignore
        continue;
      } else {
        // Some other line (could be empty or malformed), treat as context
        if (currentHunk.lines.length > 0) {
          currentHunk.lines.push({
            type: 'context',
            oldLineNumber: oldLineNumber,
            newLineNumber: newLineNumber,
            content: line,
          });
          oldLineNumber++;
          newLineNumber++;
        }
      }
    }
  }

  // Save the last hunk and file
  if (currentHunk && currentHunk.header && currentFile) {
    currentFile.hunks!.push(currentHunk as DiffHunk);
  }
  flushFile();

  return files;
}

function stripPrefix(path: string): string {
  // Remove single-character prefix (a/, b/, c/, i/, w/, etc.)
  // Git uses a/b by default, but mnemonicPrefix uses c/i/w/o
  if (path.length > 2 && path[1] === '/') {
    return path.substring(2);
  }
  return path;
}

function decodeGitPath(path: string): string {
  if (!path.startsWith('"') || !path.endsWith('"')) return path;

  const escapes: Record<string, string> = {
    a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v',
    '"': '"', '\\': '\\',
  };
  return path.slice(1, -1).replace(
    /(?:\\[0-7]{1,3})+|\\[abfnrtv"\\]/g,
    (escape) => {
      if (/^\\[0-7]/.test(escape)) {
        // Git quotes UTF-8 bytes as octal, so decode each run together.
        const bytes = escape.slice(1).split('\\').map((byte) => parseInt(byte, 8));
        return Buffer.from(bytes).toString('utf8');
      }
      return escapes[escape[1]];
    }
  );
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
  const boundary = separators.find((match) =>
    stripPrefix(paths.substring(0, match.index)) ===
    stripPrefix(paths.substring(match.index! + 1))
  ) || separators[0];
  if (!boundary) return { oldPath: '', newPath: '' };

  return {
    oldPath: stripPrefix(paths.substring(0, boundary.index)),
    newPath: stripPrefix(paths.substring(boundary.index! + 1)),
  };
}
