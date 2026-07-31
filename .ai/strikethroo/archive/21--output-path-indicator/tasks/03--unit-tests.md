---
id: 3
group: 'output-path-indicator'
dependencies: [1, 2]
status: 'completed'
created: '2026-02-27'
skills:
  - vitest
  - typescript
---

# Add Unit Tests for Output Path Writability Check and IPC Handler

## Objective

Write unit tests for the writability check logic and the output-path:change IPC handler in the main process. Focus on critical business logic — not framework plumbing.

## Skills Required

- vitest: Unit testing with mocks
- typescript: Type-safe test code

## Acceptance Criteria

- [ ] Tests for writability check: writable directory returns true, unwritable directory returns false, non-existent directory returns false
- [ ] Tests for save dialog handler: returns OutputPathInfo on selection, returns null on cancel, updates internal state on selection
- [ ] Tests for save handler using currentOutputPath instead of re-resolving from config
- [ ] All tests pass with `npm run test:unit:main`

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Vitest for test runner
- Mock `fs.accessSync`, `dialog.showSaveDialog`, and `ipcMain.handle`
- Follow existing test patterns in `src/main/*.test.ts`

## Input Dependencies

- Task 1: Main process implementation (writability check function, IPC handler)
- Task 2: Renderer implementation (to ensure integration is testable)

## Output Artifacts

- New or updated test files in `src/main/` for writability and output path logic

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Meaningful Test Strategy Guidelines

Your critical mantra for test generation is: "write a few tests, mostly integration".

**When TO Write Tests:**
- Custom business logic and algorithms
- Critical user workflows and data transformations
- Edge cases and error conditions for core functionality

**When NOT to Write Tests:**
- Third-party library functionality (already tested upstream)
- Framework features (Electron dialog, IPC middleware, etc.)
- Simple CRUD operations without custom logic

### Test Focus

The writability check is a custom utility function that wraps `fs.accessSync`. Test it because:
- It's the core logic that determines whether the user can save
- Wrong behavior leads to the exact bug we're fixing (crash on unwritable path)

The save dialog handler integrates multiple concerns (dialog, state update, writability recheck). Test the state management aspects, not the Electron dialog itself.

### Example Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('checkWritability', () => {
  it('returns true when parent directory is writable', () => {
    // Mock fs.accessSync to not throw
    // Call checkWritability('/tmp/review.xml')
    // Expect true
  });

  it('returns false when parent directory is not writable', () => {
    // Mock fs.accessSync to throw EACCES
    // Call checkWritability('/review.xml')
    // Expect false
  });

  it('returns false when parent directory does not exist', () => {
    // Mock fs.accessSync to throw ENOENT
    // Call checkWritability('/nonexistent/dir/review.xml')
    // Expect false
  });
});
```

### Important Notes

- Look at existing test files in `src/main/` to match patterns (e.g., `diff-parser.test.ts`, `xml-serializer.test.ts`).
- The writability check function should be exported from wherever it's defined so it can be tested directly.
- Keep tests focused — don't test that Electron's dialog works, test that your code handles the dialog's return values correctly.
</details>
