---
id: 4
group: "priority-tests"
dependencies: [1]
status: "pending"
created: "2026-02-12"
skills:
  - vitest
  - react
---
# Test useReviewState Hook

## Objective

Write comprehensive unit tests for the `useReviewState` React hook, which manages all review state including comments, suggestions, and viewed status. This is a priority module with complex state management logic.

## Skills Required

- **vitest**: Write tests for React hooks using Vitest's testing utilities
- **react**: Test React hook state transitions and side effects

## Acceptance Criteria

- [ ] Test file created at `src/renderer/hooks/useReviewState.test.ts`
- [ ] Tests cover addComment functionality (file-level and line-level)
- [ ] Tests cover updateComment functionality (updates existing comments)
- [ ] Tests cover deleteComment functionality (removes comments by ID)
- [ ] Tests cover toggleViewed functionality (marks files as viewed/unviewed)
- [ ] Tests cover getCommentsForFile and getCommentsForLine getter functions
- [ ] Tests verify unique ID generation for comments
- [ ] Tests verify state immutability and correct state transitions
- [ ] All tests pass with `npm run test:unit:renderer`
- [ ] Test suite contributes to 50-60% coverage target

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

### Module to Test

**File**: `src/renderer/hooks/useReviewState.ts`
**Hook**: `useReviewState(): UseReviewStateReturn`

### Hook Interface

```typescript
interface UseReviewStateReturn {
  files: FileReviewState[];
  setFiles: React.Dispatch<React.SetStateAction<FileReviewState[]>>;
  addComment: (
    filePath: string,
    lineRange: LineRange | null,
    body: string,
    category: string,
    suggestion: Suggestion | null
  ) => void;
  updateComment: (id: string, updates: Partial<ReviewComment>) => void;
  deleteComment: (id: string) => void;
  toggleViewed: (filePath: string) => void;
  getCommentsForFile: (filePath: string) => ReviewComment[];
  getCommentsForLine: (filePath: string, lineNumber: number, side: 'old' | 'new') => ReviewComment[];
}
```

### Test Structure

```typescript
describe('useReviewState', () => {
  describe('addComment', () => {
    it('adds file-level comment to file');
    it('adds line-level comment with newLineRange');
    it('generates unique ID for each comment');
    it('includes all provided fields in comment');
  });

  describe('updateComment', () => {
    it('updates existing comment fields');
    it('preserves unchanged fields');
    it('no-op for non-existent comment ID');
  });

  describe('deleteComment', () => {
    it('removes comment by ID');
    it('no-op for non-existent comment ID');
  });

  describe('toggleViewed', () => {
    it('marks file as viewed when unviewed');
    it('marks file as unviewed when viewed');
  });

  describe('getters', () => {
    it('getCommentsForFile returns all file comments');
    it('getCommentsForLine returns comments for specific line on new side');
    it('getCommentsForLine returns comments for specific line on old side');
    it('getCommentsForLine filters by side correctly');
  });
});
```

### Testing React Hooks with Vitest

Use Vitest's `renderHook` utility (similar to React Testing Library's):

```typescript
import { renderHook, act } from '@testing-library/react';
import { useReviewState } from './useReviewState';
```

Or use Vitest's built-in approach if available.

## Input Dependencies

- Task 1: Vitest infrastructure (renderer config with jsdom)
- `src/renderer/hooks/useReviewState.ts`: Hook to test
- `src/shared/types.ts`: Type definitions
- `@testing-library/react` or Vitest's hook testing utilities

## Output Artifacts

- `src/renderer/hooks/useReviewState.test.ts`: Comprehensive test suite for the hook
- Passing tests verifiable with `npm run test:unit:renderer`

## Implementation Notes

<details>
<summary>Testing Approach for React Hooks</summary>

**IMPORTANT**: Write a few tests, mostly integration. Focus on testing the state management logic and data integrity, not every edge case exhaustively.

### Meaningful Test Strategy Guidelines

**Definition of "Meaningful Tests":**
Tests that verify custom business logic, critical paths, and edge cases specific to the application. Focus on testing YOUR code, not the framework or library functionality.

**When TO Write Tests:**
- Custom business logic and algorithms (✅ comment CRUD operations)
- Critical user workflows and data transformations (✅ review state management)
- Edge cases and error conditions for core functionality (✅ updating non-existent comments)
- Complex state management logic (✅ this hook manages all review state)

**When NOT to Write Tests:**
- React's built-in hook functionality (useState, useEffect already tested by React)
- Simple getter/setter operations without custom logic
- Framework features

### Example Test Implementation

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReviewState } from './useReviewState';
import type { FileReviewState } from '../../shared/types';

describe('useReviewState', () => {
  describe('addComment', () => {
    it('adds file-level comment to file', () => {
      const { result } = renderHook(() => useReviewState());

      // Initialize with a file
      act(() => {
        result.current.setFiles([
          { path: 'src/test.ts', viewed: false, comments: [] },
        ]);
      });

      // Add file-level comment
      act(() => {
        result.current.addComment(
          'src/test.ts',
          null, // File-level
          'This file looks good',
          'praise',
          null
        );
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('This file looks good');
      expect(comments[0].category).toBe('praise');
      expect(comments[0].lineRange).toBeNull();
      expect(comments[0].id).toBeTruthy(); // Has generated ID
    });

    it('adds line-level comment with newLineRange', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          { path: 'src/utils.ts', viewed: false, comments: [] },
        ]);
      });

      act(() => {
        result.current.addComment(
          'src/utils.ts',
          { newLineStart: 10, newLineEnd: 15 },
          'Consider refactoring',
          'suggestion',
          null
        );
      });

      const comments = result.current.getCommentsForFile('src/utils.ts');
      expect(comments[0].lineRange).toEqual({
        newLineStart: 10,
        newLineEnd: 15,
      });
    });

    it('generates unique ID for each comment', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          { path: 'src/test.ts', viewed: false, comments: [] },
        ]);
      });

      act(() => {
        result.current.addComment('src/test.ts', null, 'Comment 1', 'note', null);
        result.current.addComment('src/test.ts', null, 'Comment 2', 'note', null);
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments).toHaveLength(2);
      expect(comments[0].id).not.toBe(comments[1].id);
      expect(comments[0].id).toBeTruthy();
      expect(comments[1].id).toBeTruthy();
    });

    it('includes suggestion when provided', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          { path: 'src/bug.ts', viewed: false, comments: [] },
        ]);
      });

      const suggestion = {
        oldCode: 'const x = foo();',
        newCode: 'const x = bar();',
      };

      act(() => {
        result.current.addComment(
          'src/bug.ts',
          { newLineStart: 42, newLineEnd: 42 },
          'Fix this bug',
          'bug',
          suggestion
        );
      });

      const comments = result.current.getCommentsForFile('src/bug.ts');
      expect(comments[0].suggestion).toEqual(suggestion);
    });
  });

  describe('updateComment', () => {
    it('updates existing comment fields', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            viewed: false,
            comments: [
              {
                id: 'comment-1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Original body',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      act(() => {
        result.current.updateComment('comment-1', {
          body: 'Updated body',
          category: 'question',
        });
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments[0].body).toBe('Updated body');
      expect(comments[0].category).toBe('question');
    });

    it('preserves unchanged fields', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            viewed: false,
            comments: [
              {
                id: 'comment-1',
                filePath: 'src/test.ts',
                lineRange: { newLineStart: 5, newLineEnd: 10 },
                body: 'Original',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      act(() => {
        result.current.updateComment('comment-1', { body: 'Updated' });
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments[0].body).toBe('Updated');
      expect(comments[0].category).toBe('note'); // Unchanged
      expect(comments[0].lineRange).toEqual({ newLineStart: 5, newLineEnd: 10 }); // Unchanged
    });

    it('no-op for non-existent comment ID', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          { path: 'src/test.ts', viewed: false, comments: [] },
        ]);
      });

      act(() => {
        result.current.updateComment('non-existent-id', { body: 'New body' });
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments).toHaveLength(0); // No change
    });
  });

  describe('deleteComment', () => {
    it('removes comment by ID', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            viewed: false,
            comments: [
              {
                id: 'comment-1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'To be deleted',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      act(() => {
        result.current.deleteComment('comment-1');
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments).toHaveLength(0);
    });

    it('no-op for non-existent comment ID', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            viewed: false,
            comments: [
              {
                id: 'comment-1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Keep this',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      act(() => {
        result.current.deleteComment('non-existent-id');
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments).toHaveLength(1); // Still there
    });
  });

  describe('toggleViewed', () => {
    it('marks file as viewed when unviewed', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          { path: 'src/test.ts', viewed: false, comments: [] },
        ]);
      });

      act(() => {
        result.current.toggleViewed('src/test.ts');
      });

      expect(result.current.files[0].viewed).toBe(true);
    });

    it('marks file as unviewed when viewed', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          { path: 'src/test.ts', viewed: true, comments: [] },
        ]);
      });

      act(() => {
        result.current.toggleViewed('src/test.ts');
      });

      expect(result.current.files[0].viewed).toBe(false);
    });
  });

  describe('getters', () => {
    it('getCommentsForFile returns all file comments', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            viewed: false,
            comments: [
              { id: '1', filePath: 'src/test.ts', lineRange: null, body: 'Comment 1', category: 'note', suggestion: null },
              { id: '2', filePath: 'src/test.ts', lineRange: null, body: 'Comment 2', category: 'note', suggestion: null },
            ],
          },
        ]);
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments).toHaveLength(2);
    });

    it('getCommentsForLine returns comments for specific line on new side', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            viewed: false,
            comments: [
              { id: '1', filePath: 'src/test.ts', lineRange: { newLineStart: 10, newLineEnd: 10 }, body: 'Line 10', category: 'note', suggestion: null },
              { id: '2', filePath: 'src/test.ts', lineRange: { newLineStart: 20, newLineEnd: 20 }, body: 'Line 20', category: 'note', suggestion: null },
            ],
          },
        ]);
      });

      const comments = result.current.getCommentsForLine('src/test.ts', 10, 'new');
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('Line 10');
    });

    it('getCommentsForLine filters by side correctly', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            viewed: false,
            comments: [
              { id: '1', filePath: 'src/test.ts', lineRange: { newLineStart: 10, newLineEnd: 10 }, body: 'New line', category: 'note', suggestion: null },
              { id: '2', filePath: 'src/test.ts', lineRange: { oldLineStart: 10, oldLineEnd: 10 }, body: 'Old line', category: 'note', suggestion: null },
            ],
          },
        ]);
      });

      const newComments = result.current.getCommentsForLine('src/test.ts', 10, 'new');
      const oldComments = result.current.getCommentsForLine('src/test.ts', 10, 'old');

      expect(newComments).toHaveLength(1);
      expect(newComments[0].body).toBe('New line');
      expect(oldComments).toHaveLength(1);
      expect(oldComments[0].body).toBe('Old line');
    });
  });
});
```

### Dependencies

If `@testing-library/react` is not yet installed, add it:

```bash
npm install -D @testing-library/react
```

### Tips for Testing Hooks

1. **Use renderHook**: Wrap hook in `renderHook()` to test it in isolation
2. **Use act()**: Wrap state updates in `act()` to ensure React processes updates
3. **Test State Transitions**: Focus on how state changes in response to actions
4. **Test Immutability**: Verify state is updated immutably (not mutated)
5. **Test Edge Cases**: Non-existent IDs, empty state, multiple operations

### Running Tests

```bash
npm run test:unit:renderer -- useReviewState.test.ts
npm run test:coverage -- src/renderer/hooks/useReviewState.test.ts
```

</details>
