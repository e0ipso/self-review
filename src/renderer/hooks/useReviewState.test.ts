import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReviewState } from './useReviewState';

describe('useReviewState', () => {
  describe('addComment', () => {
    it('adds file-level comment to file', () => {
      const { result } = renderHook(() => useReviewState());

      // Initialize with a file
      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
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
          {
            path: 'src/utils.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
        ]);
      });

      act(() => {
        result.current.addComment(
          'src/utils.ts',
          { side: 'new', start: 10, end: 15 },
          'Consider refactoring',
          'suggestion',
          null
        );
      });

      const comments = result.current.getCommentsForFile('src/utils.ts');
      expect(comments[0].lineRange).toEqual({
        side: 'new',
        start: 10,
        end: 15,
      });
    });

    it('generates unique ID for each comment', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
        ]);
      });

      act(() => {
        result.current.addComment(
          'src/test.ts',
          null,
          'Comment 1',
          'note',
          null
        );
        result.current.addComment(
          'src/test.ts',
          null,
          'Comment 2',
          'note',
          null
        );
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
          {
            path: 'src/bug.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
        ]);
      });

      const suggestion = {
        originalCode: 'const x = foo();',
        proposedCode: 'const x = bar();',
      };

      act(() => {
        result.current.addComment(
          'src/bug.ts',
          { side: 'new', start: 42, end: 42 },
          'Fix this bug',
          'bug',
          suggestion
        );
      });

      const comments = result.current.getCommentsForFile('src/bug.ts');
      expect(comments[0].suggestion).toEqual(suggestion);
    });

    it('includes all provided fields in comment', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/feature.ts',
            changeType: 'added',
            viewed: false,
            comments: [],
          },
        ]);
      });

      const suggestion = {
        originalCode: 'old code',
        proposedCode: 'new code',
      };

      act(() => {
        result.current.addComment(
          'src/feature.ts',
          { side: 'new', start: 5, end: 10 },
          'Full featured comment',
          'question',
          suggestion
        );
      });

      const comments = result.current.getCommentsForFile('src/feature.ts');
      expect(comments[0]).toMatchObject({
        filePath: 'src/feature.ts',
        lineRange: { side: 'new', start: 5, end: 10 },
        body: 'Full featured comment',
        category: 'question',
        suggestion,
      });
      expect(comments[0].id).toBeTruthy();
    });
  });

  describe('updateComment', () => {
    it('updates existing comment fields', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
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
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: 'comment-1',
                filePath: 'src/test.ts',
                lineRange: { side: 'new', start: 5, end: 10 },
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
      expect(comments[0].lineRange).toEqual({ side: 'new', start: 5, end: 10 }); // Unchanged
    });

    it('no-op for non-existent comment ID', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
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
            changeType: 'modified',
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
            changeType: 'modified',
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

    it('deletes correct comment when multiple exist', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: 'comment-1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'First',
                category: 'note',
                suggestion: null,
              },
              {
                id: 'comment-2',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Second',
                category: 'note',
                suggestion: null,
              },
              {
                id: 'comment-3',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Third',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      act(() => {
        result.current.deleteComment('comment-2');
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments).toHaveLength(2);
      expect(comments[0].body).toBe('First');
      expect(comments[1].body).toBe('Third');
    });
  });

  describe('toggleViewed', () => {
    it('marks file as viewed when unviewed', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
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
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: true,
            comments: [],
          },
        ]);
      });

      act(() => {
        result.current.toggleViewed('src/test.ts');
      });

      expect(result.current.files[0].viewed).toBe(false);
    });

    it('only toggles specified file when multiple exist', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/file1.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
          {
            path: 'src/file2.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
          {
            path: 'src/file3.ts',
            changeType: 'modified',
            viewed: true,
            comments: [],
          },
        ]);
      });

      act(() => {
        result.current.toggleViewed('src/file2.ts');
      });

      expect(result.current.files[0].viewed).toBe(false); // Unchanged
      expect(result.current.files[1].viewed).toBe(true); // Toggled
      expect(result.current.files[2].viewed).toBe(true); // Unchanged
    });
  });

  describe('getters', () => {
    it('getCommentsForFile returns all file comments', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: '1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Comment 1',
                category: 'note',
                suggestion: null,
              },
              {
                id: '2',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Comment 2',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments).toHaveLength(2);
    });

    it('getCommentsForFile returns empty array for non-existent file', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: '1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Comment 1',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      const comments = result.current.getCommentsForFile('src/nonexistent.ts');
      expect(comments).toEqual([]);
    });

    it('getCommentsForLine returns comments for specific line on new side', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: '1',
                filePath: 'src/test.ts',
                lineRange: { side: 'new', start: 10, end: 10 },
                body: 'Line 10',
                category: 'note',
                suggestion: null,
              },
              {
                id: '2',
                filePath: 'src/test.ts',
                lineRange: { side: 'new', start: 20, end: 20 },
                body: 'Line 20',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      const comments = result.current.getCommentsForLine(
        'src/test.ts',
        10,
        'new'
      );
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('Line 10');
    });

    it('getCommentsForLine filters by side correctly', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: '1',
                filePath: 'src/test.ts',
                lineRange: { side: 'new', start: 10, end: 10 },
                body: 'New line',
                category: 'note',
                suggestion: null,
              },
              {
                id: '2',
                filePath: 'src/test.ts',
                lineRange: { side: 'old', start: 10, end: 10 },
                body: 'Old line',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      const newComments = result.current.getCommentsForLine(
        'src/test.ts',
        10,
        'new'
      );
      const oldComments = result.current.getCommentsForLine(
        'src/test.ts',
        10,
        'old'
      );

      expect(newComments).toHaveLength(1);
      expect(newComments[0].body).toBe('New line');
      expect(oldComments).toHaveLength(1);
      expect(oldComments[0].body).toBe('Old line');
    });

    it('getCommentsForLine handles line ranges', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: '1',
                filePath: 'src/test.ts',
                lineRange: { side: 'new', start: 10, end: 15 },
                body: 'Range comment',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      // Line 10 is within range
      expect(
        result.current.getCommentsForLine('src/test.ts', 10, 'new')
      ).toHaveLength(1);
      // Line 12 is within range
      expect(
        result.current.getCommentsForLine('src/test.ts', 12, 'new')
      ).toHaveLength(1);
      // Line 15 is within range
      expect(
        result.current.getCommentsForLine('src/test.ts', 15, 'new')
      ).toHaveLength(1);
      // Line 9 is outside range
      expect(
        result.current.getCommentsForLine('src/test.ts', 9, 'new')
      ).toHaveLength(0);
      // Line 16 is outside range
      expect(
        result.current.getCommentsForLine('src/test.ts', 16, 'new')
      ).toHaveLength(0);
    });

    it('getCommentsForLine returns empty array for non-existent file', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: '1',
                filePath: 'src/test.ts',
                lineRange: { side: 'new', start: 10, end: 10 },
                body: 'Line 10',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      const comments = result.current.getCommentsForLine(
        'src/nonexistent.ts',
        10,
        'new'
      );
      expect(comments).toEqual([]);
    });

    it('getCommentsForLine excludes file-level comments', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: '1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'File comment',
                category: 'note',
                suggestion: null,
              },
              {
                id: '2',
                filePath: 'src/test.ts',
                lineRange: { side: 'new', start: 10, end: 10 },
                body: 'Line comment',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      const comments = result.current.getCommentsForLine(
        'src/test.ts',
        10,
        'new'
      );
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('Line comment');
    });
  });

  describe('attachment state management', () => {
    it('adds comment with attachments', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
        ]);
      });

      const attachments = [
        {
          id: 'att-1',
          fileName: 'screenshot.png',
          mediaType: 'image/png',
          data: new ArrayBuffer(8),
        },
      ];

      act(() => {
        result.current.addComment(
          'src/test.ts',
          { side: 'new', start: 5, end: 5 },
          'See attached screenshot',
          'bug',
          null,
          attachments
        );
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments).toHaveLength(1);
      expect(comments[0].attachments).toHaveLength(1);
      expect(comments[0].attachments![0].fileName).toBe('screenshot.png');
      expect(comments[0].attachments![0].mediaType).toBe('image/png');
    });

    it('updates comment attachments via updateComment', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: 'comment-att-1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Original',
                category: 'note',
                suggestion: null,
                attachments: [
                  {
                    id: 'att-old',
                    fileName: 'old.png',
                    mediaType: 'image/png',
                  },
                ],
              },
            ],
          },
        ]);
      });

      const newAttachments = [
        {
          id: 'att-new-1',
          fileName: 'new-screenshot.png',
          mediaType: 'image/png',
        },
        {
          id: 'att-new-2',
          fileName: 'diagram.jpg',
          mediaType: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.updateComment('comment-att-1', {
          attachments: newAttachments,
        });
      });

      const comments = result.current.getCommentsForFile('src/test.ts');
      expect(comments[0].attachments).toHaveLength(2);
      expect(comments[0].attachments![0].fileName).toBe('new-screenshot.png');
      expect(comments[0].attachments![1].fileName).toBe('diagram.jpg');
    });
  });

  describe('state immutability', () => {
    it('addComment does not mutate files array', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
        ]);
      });

      const filesBefore = result.current.files;

      act(() => {
        result.current.addComment(
          'src/test.ts',
          null,
          'New comment',
          'note',
          null
        );
      });

      expect(result.current.files).not.toBe(filesBefore);
      expect(result.current.files[0]).not.toBe(filesBefore[0]);
    });

    it('updateComment does not mutate files array', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: 'comment-1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Original',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      const filesBefore = result.current.files;
      const commentsBefore = filesBefore[0].comments;

      act(() => {
        result.current.updateComment('comment-1', { body: 'Updated' });
      });

      expect(result.current.files).not.toBe(filesBefore);
      expect(result.current.files[0].comments).not.toBe(commentsBefore);
    });

    it('deleteComment does not mutate files array', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: 'comment-1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'To delete',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ]);
      });

      const filesBefore = result.current.files;
      const commentsBefore = filesBefore[0].comments;

      act(() => {
        result.current.deleteComment('comment-1');
      });

      expect(result.current.files).not.toBe(filesBefore);
      expect(result.current.files[0].comments).not.toBe(commentsBefore);
    });

    it('toggleViewed does not mutate files array', () => {
      const { result } = renderHook(() => useReviewState());

      act(() => {
        result.current.setFiles([
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: false,
            comments: [],
          },
        ]);
      });

      const filesBefore = result.current.files;

      act(() => {
        result.current.toggleViewed('src/test.ts');
      });

      expect(result.current.files).not.toBe(filesBefore);
      expect(result.current.files[0]).not.toBe(filesBefore[0]);
    });
  });
});
