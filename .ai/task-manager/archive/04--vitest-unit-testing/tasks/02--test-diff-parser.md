---
id: 2
group: "priority-tests"
dependencies: [1]
status: "completed"
created: "2026-02-12"
skills:
  - vitest
  - typescript
---
# Test diff-parser Module

## Objective

Write comprehensive unit tests for the `src/main/diff-parser.ts` module, which parses unified git diff output into structured `DiffFile[]` objects. This is a priority module with critical business logic for the application.

## Skills Required

- **vitest**: Write test suites using Vitest API (describe, it, expect)
- **typescript**: Work with TypeScript interfaces and type-safe test assertions

## Acceptance Criteria

- [ ] Test file created at `src/main/diff-parser.test.ts`
- [ ] Tests cover basic operations: file addition, deletion, modification
- [ ] Tests cover hunk parsing and line number tracking (old/new line numbers)
- [ ] Tests cover edge cases: empty diffs, binary files, rename detection, no newline at EOF
- [ ] Tests use real git diff output as fixture strings (not minimal hand-crafted examples)
- [ ] All tests pass with `npm run test:unit:main`
- [ ] Test suite contributes to 50-60% coverage target

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

### Module to Test

**File**: `src/main/diff-parser.ts`
**Main function**: `parseDiff(rawDiff: string): DiffFile[]`

### Test Structure

```typescript
describe('parseDiff', () => {
  describe('basic operations', () => {
    it('parses file addition');
    it('parses file deletion');
    it('parses file modification');
  });

  describe('hunks and line numbers', () => {
    it('parses single hunk correctly');
    it('parses multiple hunks');
    it('tracks old/new line numbers accurately');
  });

  describe('edge cases', () => {
    it('handles empty diff');
    it('handles binary files');
    it('handles rename detection');
    it('handles files with no newline at EOF');
    it('handles mode changes (new file, deleted file)');
  });
});
```

### Fixture Strategy

Use **real git diff output** as test fixtures. Examples:

**File Addition**:
```
diff --git a/new-file.ts b/new-file.ts
new file mode 100644
index 0000000..abcd123
--- /dev/null
+++ b/new-file.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return 'world';
+}
```

**File Modification**:
```
diff --git a/existing.ts b/existing.ts
index abc123..def456 100644
--- a/existing.ts
+++ b/existing.ts
@@ -1,5 +1,6 @@
 export function foo() {
-  return 'old';
+  return 'new';
+  // Added comment
 }
```

Store fixtures as template strings in the test file.

### Validation

Each test should verify:
1. **Correct parsing**: Output structure matches expected `DiffFile` shape
2. **Line numbers**: `oldLineNumber` and `newLineNumber` tracked correctly
3. **Change types**: File `changeType` is accurate (added, deleted, modified)
4. **Hunks**: Number and content of hunks match input
5. **Edge cases**: Parser handles malformed or unusual input gracefully

## Input Dependencies

- Task 1: Vitest infrastructure must be set up
- `src/main/diff-parser.ts`: Module to test
- `src/shared/types.ts`: Type definitions for `DiffFile`, `DiffHunk`, `DiffLine`

## Output Artifacts

- `src/main/diff-parser.test.ts`: Comprehensive test suite for diff parser
- Passing tests verifiable with `npm run test:unit:main`

## Implementation Notes

<details>
<summary>Testing Approach and Examples</summary>

**IMPORTANT**: Write a few tests, mostly integration. Focus on testing the actual business logic of parsing diffs, not every single line or edge case exhaustively.

### Meaningful Test Strategy Guidelines

**Definition of "Meaningful Tests":**
Tests that verify custom business logic, critical paths, and edge cases specific to the application. Focus on testing YOUR code, not the framework or library functionality.

**When TO Write Tests:**
- Custom business logic and algorithms (✅ diff parsing is core logic)
- Critical user workflows and data transformations (✅ diff parsing is critical)
- Edge cases and error conditions for core functionality (✅ binary files, empty diffs)
- Integration points between different system components
- Complex validation logic or calculations

**When NOT to Write Tests:**
- Third-party library functionality (already tested upstream)
- Framework features (React hooks, Express middleware, etc.)
- Simple CRUD operations without custom logic
- Getter/setter methods or basic property access
- Configuration files or static data
- Obvious functionality that would break immediately if incorrect

### Example Test Implementation

```typescript
import { describe, it, expect } from 'vitest';
import { parseDiff } from './diff-parser';

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
      expect(result[0].oldPath).toBe('/dev/null');
      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0].lines).toHaveLength(3);
      expect(result[0].hunks[0].lines[0].type).toBe('added');
    });

    it('parses file modification with multiple hunks', () => {
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
      expect(result[0].changeType).toBe('modified');
      expect(result[0].hunks).toHaveLength(2); // Multiple hunks
      // Verify line numbers track correctly across hunks
      expect(result[0].hunks[0].newStart).toBe(1);
      expect(result[0].hunks[1].newStart).toBe(11);
    });
  });

  describe('edge cases', () => {
    it('handles empty diff', () => {
      const result = parseDiff('');
      expect(result).toEqual([]);
    });

    it('handles binary files', () => {
      const diff = `diff --git a/image.png b/image.png
Binary files a/image.png and b/image.png differ`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].isBinary).toBe(true);
      expect(result[0].hunks).toHaveLength(0);
    });

    it('handles file deletion', () => {
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
      expect(result[0].newPath).toBe('/dev/null');
    });

    it('handles rename detection', () => {
      const diff = `diff --git a/old-name.ts b/new-name.ts
similarity index 100%
rename from old-name.ts
rename to new-name.ts`;

      const result = parseDiff(diff);

      expect(result).toHaveLength(1);
      expect(result[0].oldPath).toBe('old-name.ts');
      expect(result[0].newPath).toBe('new-name.ts');
    });
  });

  describe('line number tracking', () => {
    it('tracks old and new line numbers correctly', () => {
      const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -5,4 +5,5 @@
 context line 1
-removed line
+added line 1
+added line 2
 context line 2`;

      const result = parseDiff(diff);
      const lines = result[0].hunks[0].lines;

      // Verify line numbers increment correctly
      expect(lines[0].oldLineNumber).toBe(5);
      expect(lines[0].newLineNumber).toBe(5);
      expect(lines[1].oldLineNumber).toBe(6);
      expect(lines[1].newLineNumber).toBeUndefined(); // Removed line
      expect(lines[2].newLineNumber).toBe(6); // Added line
      expect(lines[3].newLineNumber).toBe(7); // Added line
      expect(lines[4].oldLineNumber).toBe(7);
      expect(lines[4].newLineNumber).toBe(8);
    });
  });
});
```

### Tips for Writing Tests

1. **Use Real Fixtures**: Generate real git diffs with `git diff` and copy the output
2. **Test Data Transformation**: Focus on whether input correctly maps to output structure
3. **Edge Cases Matter**: Binary files, renames, and empty diffs are important edge cases
4. **Don't Over-Test**: Don't test every single line parsing—test representative cases
5. **Readable Assertions**: Use descriptive expectations that document expected behavior

### Running Tests

```bash
# Run just this test file
npm run test:unit:main -- diff-parser.test.ts

# Run with coverage
npm run test:coverage -- diff-parser.test.ts

# Watch mode during development
npm run test:unit:main -- --watch diff-parser.test.ts
```

</details>
