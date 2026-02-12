// src/main/diff-parser.ts
// Parse unified diff output into DiffFile[]

import { DiffFile, DiffHunk, ChangeType } from '../shared/types';

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start of a new file
    if (line.startsWith('diff --git ')) {
      // Save previous file if exists and has actual changes
      if (
        currentFile &&
        currentFile.oldPath !== undefined &&
        currentFile.newPath !== undefined
      ) {
        // Include files that have hunks, are binary, or are new (empty new files)
        if (
          currentFile.isBinary ||
          (currentFile.hunks && currentFile.hunks.length > 0) ||
          currentFile.changeType === 'added'
        ) {
          files.push(currentFile as DiffFile);
        }
      }

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
      continue;
    }

    if (!currentFile) continue;

    // Detect file mode changes
    if (line.startsWith('new file mode')) {
      currentFile.changeType = 'added';
      continue;
    }

    if (line.startsWith('deleted file mode')) {
      currentFile.changeType = 'deleted';
      continue;
    }

    if (line.startsWith('rename from ')) {
      currentFile.changeType = 'renamed';
      continue;
    }

    // Parse old file path
    if (line.startsWith('--- ')) {
      const path = line.substring(4);
      currentFile.oldPath = path === '/dev/null' ? '' : stripPrefix(path);
      continue;
    }

    // Parse new file path
    if (line.startsWith('+++ ')) {
      const path = line.substring(4);
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
  if (
    currentFile &&
    currentFile.oldPath !== undefined &&
    currentFile.newPath !== undefined
  ) {
    // Include files that have hunks, are binary, or are new (empty new files)
    if (
      currentFile.isBinary ||
      (currentFile.hunks && currentFile.hunks.length > 0) ||
      currentFile.changeType === 'added'
    ) {
      files.push(currentFile as DiffFile);
    }
  }

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

function parseGitDiffHeader(line: string): {
  oldPath: string;
  newPath: string;
} {
  // Format: "diff --git a/<old> b/<new>"
  // Paths may contain spaces, so we find the " b/" separator.
  // Git guarantees the b/ prefix appears after a space.
  const withoutPrefix = line.substring('diff --git '.length);

  // Find " b/" — the boundary between old and new paths.
  // Search from the midpoint-ish to handle paths that themselves contain " b/".
  const bIdx = withoutPrefix.indexOf(' b/');
  if (bIdx === -1) {
    return { oldPath: '', newPath: '' };
  }

  const oldPath = stripPrefix(withoutPrefix.substring(0, bIdx));
  const newPath = stripPrefix(withoutPrefix.substring(bIdx + 1));
  return { oldPath, newPath };
}
