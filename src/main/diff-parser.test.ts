// src/main/diff-parser.test.ts
// Comprehensive unit tests for diff-parser module

import { describe, it, expect } from 'vitest';
import { parseDiff } from './diff-parser';
import type { DiffFile, ChangeType } from '../shared/types';

describe('parseDiff', () => {
  describe('basic operations', () => {
    it('parses file addition with single hunk', () => {
      const diff = `diff --git a/new-file.ts b/new-file.ts
new file mode 100644
index 0000000..abcd123
--- /dev/null
+++ b/new-file.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return 'world';
+}`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].changeType).toBe('added');
      expect(result[0].newPath).toBe('new-file.ts');
      expect(result[0].oldPath).toBe('');
      expect(result[0].isBinary).toBe(false);
      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0].lines).toHaveLength(3);
      expect(result[0].hunks[0].lines[0].type).toBe('addition');
      expect(result[0].hunks[0].lines[0].content).toBe('export function hello() {');
    });

    it('parses file deletion with hunks showing deleted content', () => {
      const diff = `diff --git a/deleted.ts b/deleted.ts
deleted file mode 100644
index abc123..0000000
--- a/deleted.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-deleted line 1
-deleted line 2
-deleted line 3`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].changeType).toBe('deleted');
      expect(result[0].newPath).toBe('');
      expect(result[0].oldPath).toBe('deleted.ts');
      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0].lines).toHaveLength(3);
      expect(result[0].hunks[0].lines.every(line => line.type === 'deletion')).toBe(true);
    });

    it('parses file modification with mixed changes', () => {
      const diff = `diff --git a/existing.ts b/existing.ts
index abc123..def456 100644
--- a/existing.ts
+++ b/existing.ts
@@ -1,5 +1,6 @@
 export function foo() {
-  return 'old';
+  return 'new';
+  // Added comment
 }`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].changeType).toBe('modified');
      expect(result[0].oldPath).toBe('existing.ts');
      expect(result[0].newPath).toBe('existing.ts');
      expect(result[0].hunks).toHaveLength(1);

      const lines = result[0].hunks[0].lines;
      expect(lines).toHaveLength(5);
      expect(lines[0].type).toBe('context');
      expect(lines[1].type).toBe('deletion');
      expect(lines[2].type).toBe('addition');
      expect(lines[3].type).toBe('addition');
      expect(lines[4].type).toBe('context');
    });

    it('parses multiple files in a single diff', () => {
      const diff = `diff --git a/file1.ts b/file1.ts
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/file1.ts
@@ -0,0 +1 @@
+export const foo = 'bar';
diff --git a/file2.ts b/file2.ts
index def456..ghi789 100644
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,2 @@
-old line
+new line
 context`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(2);
      expect(result[0].changeType).toBe('added');
      expect(result[0].newPath).toBe('file1.ts');
      expect(result[1].changeType).toBe('modified');
      expect(result[1].newPath).toBe('file2.ts');
    });
  });

  describe('hunks and line numbers', () => {
    it('parses single hunk with correct line number tracking', () => {
      const diff = `diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -5,4 +5,5 @@
 context line 1
-removed line
+added line 1
+added line 2
 context line 2`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].hunks).toHaveLength(1);

      const hunk = result[0].hunks[0];
      expect(hunk.oldStart).toBe(5);
      expect(hunk.oldLines).toBe(4);
      expect(hunk.newStart).toBe(5);
      expect(hunk.newLines).toBe(5);

      const lines = hunk.lines;
      expect(lines[0].type).toBe('context');
      expect(lines[0].oldLineNumber).toBe(5);
      expect(lines[0].newLineNumber).toBe(5);

      expect(lines[1].type).toBe('deletion');
      expect(lines[1].oldLineNumber).toBe(6);
      expect(lines[1].newLineNumber).toBe(null);

      expect(lines[2].type).toBe('addition');
      expect(lines[2].oldLineNumber).toBe(null);
      expect(lines[2].newLineNumber).toBe(6);

      expect(lines[3].type).toBe('addition');
      expect(lines[3].oldLineNumber).toBe(null);
      expect(lines[3].newLineNumber).toBe(7);

      expect(lines[4].type).toBe('context');
      expect(lines[4].oldLineNumber).toBe(7);
      expect(lines[4].newLineNumber).toBe(8);
    });

    it('parses multiple hunks with correct line number continuity', () => {
      const diff = `diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line 1
-line 2
+line 2 modified
 line 3
+line 4 added
@@ -10,2 +11,2 @@
-old line
+new line`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].hunks).toHaveLength(2);

      // First hunk
      const hunk1 = result[0].hunks[0];
      expect(hunk1.oldStart).toBe(1);
      expect(hunk1.newStart).toBe(1);

      // Second hunk
      const hunk2 = result[0].hunks[1];
      expect(hunk2.oldStart).toBe(10);
      expect(hunk2.newStart).toBe(11);
      expect(hunk2.lines).toHaveLength(2);
    });

    it('tracks line numbers correctly across addition-only hunks', () => {
      const diff = `diff --git a/file.ts b/file.ts
new file mode 100644
--- /dev/null
+++ b/file.ts
@@ -0,0 +1,5 @@
+line 1
+line 2
+line 3
+line 4
+line 5`;

      const result = parseDiff(diff);

      const lines = result[0].hunks[0].lines;
      expect(lines).toHaveLength(5);

      lines.forEach((line, idx) => {
        expect(line.type).toBe('addition');
        expect(line.oldLineNumber).toBe(null);
        expect(line.newLineNumber).toBe(idx + 1);
      });
    });

    it('tracks line numbers correctly across deletion-only hunks', () => {
      const diff = `diff --git a/file.ts b/file.ts
deleted file mode 100644
--- a/file.ts
+++ /dev/null
@@ -1,5 +0,0 @@
-line 1
-line 2
-line 3
-line 4
-line 5`;

      const result = parseDiff(diff);

      const lines = result[0].hunks[0].lines;
      expect(lines).toHaveLength(5);

      lines.forEach((line, idx) => {
        expect(line.type).toBe('deletion');
        expect(line.oldLineNumber).toBe(idx + 1);
        expect(line.newLineNumber).toBe(null);
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty diff', () => {
      const result = parseDiff('');
      expect(result).toEqual([]);
    });

    it('handles whitespace-only diff', () => {
      const result = parseDiff('   \n\n  \t  ');
      expect(result).toEqual([]);
    });

    it('handles binary files', () => {
      const diff = `diff --git a/image.png b/image.png
index abc123..def456 100644
Binary files a/image.png and b/image.png differ`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].isBinary).toBe(true);
      expect(result[0].oldPath).toBe('image.png');
      expect(result[0].newPath).toBe('image.png');
      expect(result[0].hunks).toHaveLength(0);
      expect(result[0].changeType).toBe('modified');
    });

    it('handles binary file addition', () => {
      const diff = `diff --git a/new-image.png b/new-image.png
new file mode 100644
index 0000000..abc123
Binary files /dev/null and b/new-image.png differ`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].isBinary).toBe(true);
      expect(result[0].changeType).toBe('added');
      expect(result[0].hunks).toHaveLength(0);
    });

    it('handles rename detection without content changes', () => {
      const diff = `diff --git a/old-name.ts b/new-name.ts
similarity index 100%
rename from old-name.ts
rename to new-name.ts`;

      const result = parseDiff(diff);

      // Rename without hunks won't be included in output (parser excludes files without hunks/changes)
      // This is expected behavior - git shows rename but parser needs actual content changes
      expect(result).toHaveLength(0);
    });

    it('handles rename detection with content changes', () => {
      const diff = `diff --git a/old-name.ts b/new-name.ts
similarity index 90%
rename from old-name.ts
rename to new-name.ts
index abc123..def456 100644
--- a/old-name.ts
+++ b/new-name.ts
@@ -1,2 +1,3 @@
 line 1
-line 2
+line 2 modified
+line 3 added`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].changeType).toBe('renamed');
      expect(result[0].oldPath).toBe('old-name.ts');
      expect(result[0].newPath).toBe('new-name.ts');
      expect(result[0].hunks).toHaveLength(1);
    });

    it('handles files with no newline at EOF marker', () => {
      const diff = `diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
 line 1
-line 2
\\ No newline at end of file
+line 2 with newline`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].hunks).toHaveLength(1);

      // The "No newline" marker should not create a line
      const lines = result[0].hunks[0].lines;
      expect(lines).toHaveLength(3);
      expect(lines[0].type).toBe('context');
      expect(lines[1].type).toBe('deletion');
      expect(lines[2].type).toBe('addition');
    });

    it('handles files with no newline at EOF on both sides', () => {
      const diff = `diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old content
\\ No newline at end of file
+new content
\\ No newline at end of file`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      const lines = result[0].hunks[0].lines;
      expect(lines).toHaveLength(2);
      expect(lines[0].type).toBe('deletion');
      expect(lines[1].type).toBe('addition');
    });

    it('handles paths with spaces', () => {
      const diff = `diff --git a/path with spaces/file.ts b/path with spaces/file.ts
index abc123..def456 100644
--- a/path with spaces/file.ts
+++ b/path with spaces/file.ts
@@ -1 +1 @@
-old
+new`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].oldPath).toBe('path with spaces/file.ts');
      expect(result[0].newPath).toBe('path with spaces/file.ts');
    });

    it('handles paths with special characters', () => {
      const diff = `diff --git a/file-with-dashes_and_underscores.ts b/file-with-dashes_and_underscores.ts
index abc123..def456 100644
--- a/file-with-dashes_and_underscores.ts
+++ b/file-with-dashes_and_underscores.ts
@@ -1 +1 @@
-old
+new`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].oldPath).toBe('file-with-dashes_and_underscores.ts');
      expect(result[0].newPath).toBe('file-with-dashes_and_underscores.ts');
    });

    it('handles diff with mode change', () => {
      const diff = `diff --git a/script.sh b/script.sh
old mode 100644
new mode 100755
index abc123..def456
--- a/script.sh
+++ b/script.sh
@@ -1,2 +1,2 @@
 #!/bin/bash
-echo "old"
+echo "new"`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].changeType).toBe('modified');
      expect(result[0].hunks).toHaveLength(1);
    });

    it('handles hunk with single line count omitted', () => {
      const diff = `diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -1 +1,2 @@
-old line
+new line 1
+new line 2`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      const hunk = result[0].hunks[0];
      expect(hunk.oldStart).toBe(1);
      expect(hunk.oldLines).toBe(1);
      expect(hunk.newStart).toBe(1);
      expect(hunk.newLines).toBe(2);
    });
  });

  describe('git prefix handling', () => {
    it('strips a/ and b/ prefixes from paths', () => {
      const diff = `diff --git a/src/file.ts b/src/file.ts
index abc123..def456 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1 +1 @@
-old
+new`;

      const result = parseDiff(diff);

      expect(result[0].oldPath).toBe('src/file.ts');
      expect(result[0].newPath).toBe('src/file.ts');
    });

    it('handles paths with git mnemonic prefixes (c/, i/, w/, o/)', () => {
      const diff = `diff --git c/src/file.ts i/src/file.ts
index abc123..def456 100644
--- c/src/file.ts
+++ i/src/file.ts
@@ -1 +1 @@
-old
+new`;

      const result = parseDiff(diff);

      expect(result[0].oldPath).toBe('src/file.ts');
      expect(result[0].newPath).toBe('src/file.ts');
    });
  });

  describe('context extraction from hunk headers', () => {
    it('parses hunk header with function context', () => {
      const diff = `diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -10,3 +10,4 @@ export function myFunction() {
 line 1
-line 2
+line 2 modified
 line 3
+line 4`;

      const result = parseDiff(diff);

      expect(result[0].hunks[0].header).toContain('export function myFunction()');
    });
  });

  describe('malformed input handling', () => {
    it('handles diff without hunks gracefully', () => {
      const diff = `diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts`;

      const result = parseDiff(diff);

      // File without hunks should not be included (unless it's binary or added)
      expect(result).toHaveLength(0);
    });

    it('handles incomplete hunk header', () => {
      const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ invalid hunk header
+added line`;

      const result = parseDiff(diff);

      // Should handle gracefully, possibly skipping malformed hunk
      expect(result).toEqual([]);
    });

    it('handles missing file paths in binary diff', () => {
      const diff = `diff --git a/image.png b/new-image.png
Binary files a/image.png and b/new-image.png differ`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].oldPath).toBe('image.png');
      expect(result[0].newPath).toBe('new-image.png');
      expect(result[0].isBinary).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('handles a typical feature implementation with new file', () => {
      const diff = `diff --git a/src/components/Button.tsx b/src/components/Button.tsx
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/src/components/Button.tsx
@@ -0,0 +1,5 @@
+export const Button = () => {
+  return (
+    <button>Click me</button>
+  );
+};`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].changeType).toBe('added');
      expect(result[0].newPath).toBe('src/components/Button.tsx');
      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0].lines).toHaveLength(5);
    });

    it('handles a bug fix with code and test changes', () => {
      const diff = `diff --git a/src/utils/validator.ts b/src/utils/validator.ts
index abc123..def456 100644
--- a/src/utils/validator.ts
+++ b/src/utils/validator.ts
@@ -1,3 +1,3 @@
 export function validate(input: string): boolean {
-  return input.length > 0;
+  return input.trim().length > 0;
 }`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].newPath).toBe('src/utils/validator.ts');
      expect(result[0].changeType).toBe('modified');

      // Bug fix - added trim()
      const lines = result[0].hunks[0].lines;
      expect(lines.some(l => l.type === 'deletion' && l.content.includes('return input.length'))).toBe(true);
      expect(lines.some(l => l.type === 'addition' && l.content.includes('input.trim()'))).toBe(true);
    });
  });
});
