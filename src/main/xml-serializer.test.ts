import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { serializeReview } from './xml-serializer';
import type {
  ReviewState,
  FileReviewState,
  ReviewComment,
} from '../shared/types';

// Mock xmllint-wasm to avoid WASM loading issues in tests
vi.mock('xmllint-wasm', () => ({
  validateXML: vi.fn(() => Promise.resolve({ valid: true, errors: [] })),
}));

// Mock fs for attachment file writing tests
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    mkdirSync: vi.fn(actual.mkdirSync),
    writeFileSync: vi.fn(actual.writeFileSync),
    readFileSync: actual.readFileSync,
  };
});

const TEST_OUTPUT_PATH = '/tmp/test-review.xml';

describe('serializeReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic serialization', () => {
    it('serializes empty review with required attributes', async () => {
      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/path/to/repo' },
        files: [],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('xmlns="urn:self-review:v1"');
      expect(xml).toContain('timestamp="2024-01-15T10:30:00Z"');
      expect(xml).toContain('git-diff-args="--staged"');
      expect(xml).toContain('repository="/path/to/repo"');
      expect(xml).toContain('</review>');
    });

    it('serializes review with single file and no comments', async () => {
      const file: FileReviewState = {
        path: 'src/main.ts',
        changeType: 'modified',
        viewed: true,
        comments: [],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain(
        '<file path="src/main.ts" change-type="modified" viewed="true" />'
      );
      expect(xml).not.toContain('<comment');
    });

    it('includes timestamp, git-diff-args, and repository attributes', async () => {
      const reviewState: ReviewState = {
        timestamp: '2024-02-20T15:45:30Z',
        source: { type: 'git', gitDiffArgs: 'HEAD~3', repository: '/home/user/projects/myapp' },
        files: [],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('timestamp="2024-02-20T15:45:30Z"');
      expect(xml).toContain('git-diff-args="HEAD~3"');
      expect(xml).toContain('repository="/home/user/projects/myapp"');
    });

    it('handles multiple files with different change types', async () => {
      const files: FileReviewState[] = [
        { path: 'src/new.ts', changeType: 'added', viewed: true, comments: [] },
        {
          path: 'src/old.ts',
          changeType: 'deleted',
          viewed: false,
          comments: [],
        },
        {
          path: 'src/moved.ts',
          changeType: 'renamed',
          viewed: true,
          comments: [],
        },
      ];

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: 'main', repository: '/repo' },
        files,
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('change-type="added"');
      expect(xml).toContain('change-type="deleted"');
      expect(xml).toContain('change-type="renamed"');
    });
  });

  describe('comments', () => {
    it('serializes file-level comments (no line range)', async () => {
      const comment: ReviewComment = {
        id: '123',
        filePath: 'src/main.ts',
        lineRange: null,
        body: 'Overall looks good',
        category: 'praise',
        suggestion: null,
      };

      const file: FileReviewState = {
        path: 'src/main.ts',
        changeType: 'modified',
        viewed: true,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain(
        '<file path="src/main.ts" change-type="modified" viewed="true">'
      );
      expect(xml).toContain('<comment>');
      expect(xml).toContain('<body>Overall looks good</body>');
      expect(xml).toContain('<category>praise</category>');
      expect(xml).not.toContain('new-line-start');
      expect(xml).not.toContain('old-line-start');
    });

    it('serializes line-level comments with new line range', async () => {
      const comment: ReviewComment = {
        id: '456',
        filePath: 'src/utils.ts',
        lineRange: { side: 'new', start: 10, end: 12 },
        body: 'Consider refactoring',
        category: 'suggestion',
        suggestion: null,
      };

      const file: FileReviewState = {
        path: 'src/utils.ts',
        changeType: 'modified',
        viewed: false,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: 'HEAD~1', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('<comment new-line-start="10" new-line-end="12">');
      expect(xml).toContain('<body>Consider refactoring</body>');
      expect(xml).toContain('<category>suggestion</category>');
      expect(xml).not.toContain('old-line-start');
    });

    it('serializes line-level comments with old line range', async () => {
      const comment: ReviewComment = {
        id: '789',
        filePath: 'src/deleted.ts',
        lineRange: { side: 'old', start: 5, end: 8 },
        body: 'Why was this removed?',
        category: 'question',
        suggestion: null,
      };

      const file: FileReviewState = {
        path: 'src/deleted.ts',
        changeType: 'modified',
        viewed: true,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: 'main', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('<comment old-line-start="5" old-line-end="8">');
      expect(xml).toContain('<body>Why was this removed?</body>');
      expect(xml).not.toContain('new-line-start');
    });

    it('serializes single-line comment (start equals end)', async () => {
      const comment: ReviewComment = {
        id: 'single',
        filePath: 'src/test.ts',
        lineRange: { side: 'new', start: 42, end: 42 },
        body: 'Single line comment',
        category: 'note',
        suggestion: null,
      };

      const file: FileReviewState = {
        path: 'src/test.ts',
        changeType: 'modified',
        viewed: true,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('<comment new-line-start="42" new-line-end="42">');
    });

    it('serializes comments with suggestions', async () => {
      const comment: ReviewComment = {
        id: '999',
        filePath: 'src/bug.ts',
        lineRange: { side: 'new', start: 42, end: 42 },
        body: 'Fix the bug',
        category: 'bug',
        suggestion: {
          originalCode: 'const x = foo();',
          proposedCode: 'const x = bar();',
        },
      };

      const file: FileReviewState = {
        path: 'src/bug.ts',
        changeType: 'modified',
        viewed: false,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: 'main', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('<suggestion>');
      expect(xml).toContain('<original-code>const x = foo();</original-code>');
      expect(xml).toContain('<proposed-code>const x = bar();</proposed-code>');
      expect(xml).toContain('</suggestion>');
    });

    it('escapes special XML characters in comment body', async () => {
      const comment: ReviewComment = {
        id: '789',
        filePath: 'test.ts',
        lineRange: null,
        body: 'Use <Component> with & symbol and "quotes" and \'apostrophes\'',
        category: 'note',
        suggestion: null,
      };

      const file: FileReviewState = {
        path: 'test.ts',
        changeType: 'modified',
        viewed: false,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('&lt;Component&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;quotes&quot;');
      expect(xml).toContain('&apos;apostrophes&apos;');
      expect(xml).not.toContain('<Component>');
      expect(xml).not.toContain('& symbol');
    });

    it('escapes special characters in suggestion code', async () => {
      const comment: ReviewComment = {
        id: 'escape-test',
        filePath: 'src/test.ts',
        lineRange: { side: 'new', start: 1, end: 1 },
        body: 'Replace code',
        category: 'suggestion',
        suggestion: {
          originalCode: 'if (x < 5 && y > 10) { return "test"; }',
          proposedCode: "if (x >= 5 || y <= 10) { return 'test'; }",
        },
      };

      const file: FileReviewState = {
        path: 'src/test.ts',
        changeType: 'modified',
        viewed: true,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('&lt;');
      expect(xml).toContain('&gt;');
      expect(xml).toContain('&amp;&amp;');
      expect(xml).toContain('&quot;test&quot;');
      expect(xml).toContain('&apos;test&apos;');
    });

    it('escapes special characters in file paths', async () => {
      const file: FileReviewState = {
        path: 'src/test&file<name>.ts',
        changeType: 'added',
        viewed: true,
        comments: [],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('src/test&amp;file&lt;name&gt;.ts');
    });

    it('handles multiple comments on same file', async () => {
      const comments: ReviewComment[] = [
        {
          id: '1',
          filePath: 'src/main.ts',
          lineRange: null,
          body: 'File-level comment',
          category: 'note',
          suggestion: null,
        },
        {
          id: '2',
          filePath: 'src/main.ts',
          lineRange: { side: 'new', start: 10, end: 10 },
          body: 'Line comment',
          category: 'issue',
          suggestion: null,
        },
        {
          id: '3',
          filePath: 'src/main.ts',
          lineRange: { side: 'new', start: 20, end: 25 },
          body: 'Range comment',
          category: 'suggestion',
          suggestion: { originalCode: 'old', proposedCode: 'new' },
        },
      ];

      const file: FileReviewState = {
        path: 'src/main.ts',
        changeType: 'modified',
        viewed: true,
        comments,
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('<body>File-level comment</body>');
      expect(xml).toContain('<body>Line comment</body>');
      expect(xml).toContain('<body>Range comment</body>');
      expect((xml.match(/<comment/g) || []).length).toBe(3);
    });
  });

  describe('validation', () => {
    it('produces valid XML structure', async () => {
      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      // Check basic XML structure
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
        true
      );
      expect(xml).toContain('<review');
      expect(xml).toContain('</review>');
      expect(xml.indexOf('<review')).toBeLessThan(xml.indexOf('</review>'));
    });

    it('calls validateXML with correct parameters', async () => {
      const { validateXML } = await import('xmllint-wasm');

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [],
      };

      await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(validateXML).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(validateXML).mock.calls[0][0];
      expect(callArgs.xml).toHaveLength(1);
      expect(callArgs.xml[0].fileName).toBe('review.xml');
      expect(callArgs.schema).toHaveLength(1);
      expect(callArgs.schema[0].fileName).toBe('self-review-v1.xsd');
    });

    it('throws error if validation fails', async () => {
      const { validateXML } = await import('xmllint-wasm');
      vi.mocked(validateXML).mockResolvedValueOnce({
        valid: false,
        errors: ['Test error'],
      } as any);

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [],
      };

      await expect(serializeReview(reviewState, TEST_OUTPUT_PATH)).rejects.toThrow(
        'Generated XML does not conform to schema'
      );
    });

    it('gracefully falls back when validation infrastructure fails (e.g. WASM load)', async () => {
      const { validateXML } = await import('xmllint-wasm');
      vi.mocked(validateXML).mockRejectedValueOnce(new Error('WASM load failed'));

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      // Should return XML without throwing (graceful fallback)
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('xmlns="urn:self-review:v1"');
      expect(xml).toContain('timestamp="2024-01-15T10:30:00Z"');
      expect(xml).toContain('</review>');
    });
  });

  describe('attachment serialization', () => {
    it('emits attachment elements with path and media-type', async () => {
      const comment: ReviewComment = {
        id: 'att-comment-1',
        filePath: 'src/main.ts',
        lineRange: { side: 'new', start: 1, end: 1 },
        body: 'See screenshot',
        category: 'bug',
        suggestion: null,
        attachments: [
          {
            id: 'att-1',
            fileName: 'screenshot.png',
            mediaType: 'image/png',
            data: new ArrayBuffer(8),
          },
        ],
      };

      const file: FileReviewState = {
        path: 'src/main.ts',
        changeType: 'modified',
        viewed: true,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, '/tmp/test-output/review.xml');

      expect(xml).toContain('<attachment path=".self-review-assets/');
      expect(xml).toContain('media-type="image/png"');
      expect(xml).toContain('/>');
    });

    it('writes image files to .self-review-assets directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

      const imageData = new ArrayBuffer(16);
      const comment: ReviewComment = {
        id: 'att-write-1',
        filePath: 'src/main.ts',
        lineRange: { side: 'new', start: 1, end: 1 },
        body: 'Image attached',
        category: 'note',
        suggestion: null,
        attachments: [
          {
            id: 'img-1',
            fileName: 'capture.png',
            mediaType: 'image/png',
            data: imageData,
          },
        ],
      };

      const file: FileReviewState = {
        path: 'src/main.ts',
        changeType: 'modified',
        viewed: true,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [file],
      };

      await serializeReview(reviewState, '/tmp/test-output/review.xml');

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        '/tmp/test-output/.self-review-assets',
        { recursive: true }
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.self-review-assets/att-write-1-0.png'),
        expect.any(Buffer)
      );
    });

    it('skips asset directory when no attachments exist', async () => {
      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: true,
            comments: [
              {
                id: 'no-att',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'No attachments here',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ],
      };

      await serializeReview(reviewState, '/tmp/test-output/review.xml');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('real-world scenarios', () => {
    it('serializes complex multi-file review', async () => {
      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: 'main..feature', repository: '/home/user/project' },
        files: [
          {
            path: 'src/components/Button.tsx',
            changeType: 'modified',
            viewed: true,
            comments: [
              {
                id: 'c1',
                filePath: 'src/components/Button.tsx',
                lineRange: { side: 'new', start: 15, end: 20 },
                body: 'Consider using a const for this value',
                category: 'suggestion',
                suggestion: null,
              },
            ],
          },
          {
            path: 'src/utils/helpers.ts',
            changeType: 'added',
            viewed: true,
            comments: [],
          },
          {
            path: 'src/legacy/old.ts',
            changeType: 'deleted',
            viewed: false,
            comments: [
              {
                id: 'c2',
                filePath: 'src/legacy/old.ts',
                lineRange: { side: 'old', start: 10, end: 10 },
                body: 'Why was this function removed?',
                category: 'question',
                suggestion: null,
              },
            ],
          },
        ],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('src/components/Button.tsx');
      expect(xml).toContain('src/utils/helpers.ts');
      expect(xml).toContain('src/legacy/old.ts');
      expect(xml).toContain('change-type="modified"');
      expect(xml).toContain('change-type="added"');
      expect(xml).toContain('change-type="deleted"');
    });

    it('handles empty string in fields', async () => {
      const comment: ReviewComment = {
        id: 'empty-test',
        filePath: 'test.ts',
        lineRange: null,
        body: '',
        category: '',
        suggestion: null,
      };

      const file: FileReviewState = {
        path: 'test.ts',
        changeType: 'modified',
        viewed: true,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '', repository: '' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('<body></body>');
      expect(xml).toContain('<category></category>');
    });

    it('handles multiline comment body', async () => {
      const comment: ReviewComment = {
        id: 'multiline',
        filePath: 'test.ts',
        lineRange: null,
        body: 'First line\nSecond line\nThird line',
        category: 'note',
        suggestion: null,
      };

      const file: FileReviewState = {
        path: 'test.ts',
        changeType: 'modified',
        viewed: true,
        comments: [comment],
      };

      const reviewState: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [file],
      };

      const xml = await serializeReview(reviewState, TEST_OUTPUT_PATH);

      expect(xml).toContain('<body>First line\nSecond line\nThird line</body>');
    });
  });
});
