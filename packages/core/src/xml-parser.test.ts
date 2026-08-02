import { describe, it, expect, vi } from 'vitest';
import { parseReviewXmlString, parseReviewXml } from './xml-parser';
import { serializeReview } from './xml-serializer';
import type {
  ReviewState,
  FileReviewState,
  ReviewComment,
} from './types';
import { readFileSync } from 'fs';

// Mock xmllint-wasm for serializer tests
vi.mock('xmllint-wasm', () => ({
  validateXML: vi.fn(() => Promise.resolve({ valid: true, errors: [] })),
}));

// Mock fs for file reading tests
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

describe('parseReviewXmlString', () => {
  describe('basic parsing', () => {
    it('parses empty review (no files)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toEqual([]);
      expect(result.gitDiffArgs).toBe('--staged');
    });

    it('parses single comment with all fields', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="15">
      <body>Test comment body</body>
      <category>issue</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].filePath).toBe('src/main.ts');
      expect(result.comments[0].body).toBe('Test comment body');
      expect(result.comments[0].category).toBe('issue');
      expect(result.comments[0].lineRange).toEqual({
        side: 'new',
        start: 10,
        end: 15,
      });
    });

    it('extracts file path, body, and category correctly', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="HEAD~1"
        repository="/repo">
  <file path="src/utils.ts" change-type="added" viewed="false">
    <comment>
      <body>This is a great addition!</body>
      <category>praise</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].filePath).toBe('src/utils.ts');
      expect(result.comments[0].body).toBe('This is a great addition!');
      expect(result.comments[0].category).toBe('praise');
    });

    it('parses review with multiple files', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/file1.ts" change-type="modified" viewed="true">
    <comment>
      <body>Comment on file 1</body>
      <category>note</category>
    </comment>
  </file>
  <file path="src/file2.ts" change-type="added" viewed="true" />
  <file path="src/file3.ts" change-type="deleted" viewed="false">
    <comment>
      <body>Comment on file 3</body>
      <category>question</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].filePath).toBe('src/file1.ts');
      expect(result.comments[1].filePath).toBe('src/file3.ts');
    });

    it('extracts git-diff-args from review attributes', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="main..feature"
        repository="/repo">
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.gitDiffArgs).toBe('main..feature');
    });

    it('parses git source from review attributes', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/home/user/repo">
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.source).toEqual({
        type: 'git',
        gitDiffArgs: '--staged',
        repository: '/home/user/repo',
      });
    });

    it('parses directory source from source-path attribute', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        source-path="/home/user/my-project">
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.source).toEqual({
        type: 'directory',
        sourcePath: '/home/user/my-project',
      });
      expect(result.gitDiffArgs).toBe('');
    });

    it('parses welcome source when no source attributes present', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z">
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.source).toEqual({ type: 'welcome' });
    });
  });

  describe('line ranges', () => {
    it('parses new line range for added lines', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/utils.ts" change-type="modified" viewed="false">
    <comment new-line-start="10" new-line-end="15">
      <body>This needs fixing</body>
      <category>issue</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].lineRange).toEqual({
        side: 'new',
        start: 10,
        end: 15,
      });
    });

    it('parses old line range for deleted lines', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="HEAD~1"
        repository="/repo">
  <file path="src/deleted.ts" change-type="modified" viewed="true">
    <comment old-line-start="5" old-line-end="10">
      <body>Why was this removed?</body>
      <category>question</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].lineRange).toEqual({
        side: 'old',
        start: 5,
        end: 10,
      });
    });

    it('handles file-level comments (no line attributes)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment>
      <body>Why this approach?</body>
      <category>question</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].lineRange).toBeNull();
    });

    it('parses single-line comment (start equals end)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/test.ts" change-type="modified" viewed="true">
    <comment new-line-start="42" new-line-end="42">
      <body>Single line</body>
      <category>note</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments[0].lineRange).toEqual({
        side: 'new',
        start: 42,
        end: 42,
      });
    });
  });

  describe('suggestions', () => {
    it('parses suggestion blocks with originalCode and proposedCode', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="main"
        repository="/repo">
  <file path="src/bug.ts" change-type="modified" viewed="false">
    <comment new-line-start="42" new-line-end="42">
      <body>Fix this</body>
      <category>bug</category>
      <suggestion>
        <original-code>const x = foo();</original-code>
        <proposed-code>const x = bar();</proposed-code>
      </suggestion>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].suggestion).toEqual({
        originalCode: 'const x = foo();',
        proposedCode: 'const x = bar();',
      });
    });

    it('handles comment without suggestion', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/test.ts" change-type="modified" viewed="true">
    <comment>
      <body>No suggestion here</body>
      <category>note</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments[0].suggestion).toBeNull();
    });

    it('parses multiline suggestion code', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/test.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="15">
      <body>Refactor this</body>
      <category>suggestion</category>
      <suggestion>
        <original-code>function foo() {
  return bar();
}</original-code>
        <proposed-code>const foo = () => bar();</proposed-code>
      </suggestion>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments[0].suggestion?.originalCode).toBe(
        'function foo() {\n  return bar();\n}'
      );
      expect(result.comments[0].suggestion?.proposedCode).toBe(
        'const foo = () => bar();'
      );
    });
  });

  describe('error handling', () => {
    it('exits on parsing errors for missing root element', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <file path="test.ts" />
</root>`;
      const mockExit = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);

      parseReviewXmlString(xml);

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it('handles missing optional fields gracefully', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/test.ts" change-type="modified" viewed="true">
    <comment>
      <body></body>
      <category></category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].body).toBe('');
      expect(result.comments[0].category).toBe('');
      expect(result.comments[0].suggestion).toBeNull();
    });

    it('handles file with no path attribute gracefully', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file change-type="modified" viewed="true">
    <comment>
      <body>Test</body>
      <category>note</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      // Should skip file without path
      expect(result.comments).toEqual([]);
    });

    it('handles lenient XML parsing', () => {
      // fast-xml-parser is lenient and will parse malformed XML
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="test.ts" change-type="modified" viewed="true" />
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toEqual([]);
      expect(result.gitDiffArgs).toBe('--staged');
    });
  });

  describe('special characters', () => {
    it('handles escaped XML entities in body', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="test.ts" change-type="modified" viewed="true">
    <comment>
      <body>Use &lt;Component&gt; with &amp; symbol and &quot;quotes&quot;</body>
      <category>note</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments[0].body).toBe(
        'Use <Component> with & symbol and "quotes"'
      );
    });

    it('handles escaped entities in suggestion code', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="test.ts" change-type="modified" viewed="true">
    <comment new-line-start="1" new-line-end="1">
      <body>Fix comparison</body>
      <category>bug</category>
      <suggestion>
        <original-code>if (x &lt; 5 &amp;&amp; y &gt; 10) { }</original-code>
        <proposed-code>if (x &lt;= 5 || y &gt;= 10) { }</proposed-code>
      </suggestion>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments[0].suggestion?.originalCode).toBe(
        'if (x < 5 && y > 10) { }'
      );
      expect(result.comments[0].suggestion?.proposedCode).toBe(
        'if (x <= 5 || y >= 10) { }'
      );
    });
  });

  describe('parseReviewXml (file reading)', () => {
    it('reads file and parses XML', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
</review>`;

      vi.mocked(readFileSync).mockReturnValueOnce(xmlContent);

      const result = parseReviewXml('/path/to/review.xml');

      expect(readFileSync).toHaveBeenCalledWith('/path/to/review.xml', 'utf-8');
      expect(result.comments).toEqual([]);
    });

    it('exits with error code on file read failure', () => {
      const mockExit = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      vi.mocked(readFileSync).mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      parseReviewXml('/nonexistent.xml');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('round-trip', () => {
    it('serialize then parse yields equivalent data', async () => {
      const original: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: true,
            comments: [
              {
                id: 'id-1',
                filePath: 'src/test.ts',
                lineRange: { side: 'new', start: 5, end: 10 },
                body: 'Test comment',
                category: 'note',
                suggestion: {
                  originalCode: 'old',
                  proposedCode: 'new',
                },
              },
            ],
          },
        ],
      };

      const xml = await serializeReview(original, '/tmp/test-review.xml');
      const parsed = parseReviewXmlString(xml);

      expect(parsed.comments).toHaveLength(1);
      expect(parsed.comments[0].filePath).toBe(
        original.files[0].comments[0].filePath
      );
      expect(parsed.comments[0].body).toBe(original.files[0].comments[0].body);
      expect(parsed.comments[0].category).toBe(
        original.files[0].comments[0].category
      );
      expect(parsed.comments[0].lineRange).toEqual(
        original.files[0].comments[0].lineRange
      );
      expect(parsed.comments[0].suggestion).toEqual(
        original.files[0].comments[0].suggestion
      );
      expect(parsed.gitDiffArgs).toBe((original.source as { type: 'git'; gitDiffArgs: string }).gitDiffArgs);
    });

    it('round-trip preserves severity and confidence', async () => {
      const original: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: true,
            comments: [
              {
                id: 'id-1',
                filePath: 'src/test.ts',
                lineRange: { side: 'new', start: 5, end: 10 },
                body: 'Test comment',
                category: 'bug',
                suggestion: null,
                author: 'Claude Opus 5',
                severity: 'major',
                confidence: 'medium',
              },
            ],
          },
        ],
      };

      const parsed = parseReviewXmlString(await serializeReview(original, '/tmp/test-review.xml'));

      expect(parsed.comments[0].author).toBe('Claude Opus 5');
      expect(parsed.comments[0].severity).toBe('major');
      expect(parsed.comments[0].confidence).toBe('medium');
    });

    // Absent must stay absent: a consumer reads absent as "below every floor",
    // so materializing a default here would silently change that meaning.
    it('round-trip leaves absent signals absent rather than defaulting them', async () => {
      const original: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: true,
            comments: [
              {
                id: 'id-1',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Human comment',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ],
      };

      const xml = await serializeReview(original, '/tmp/test-review.xml');
      const parsed = parseReviewXmlString(xml);

      expect(xml).not.toContain('severity=');
      expect(xml).not.toContain('confidence=');
      expect(parsed.comments[0].severity).toBeUndefined();
      expect(parsed.comments[0].confidence).toBeUndefined();
    });

    it('round-trip with directory source', async () => {
      const original: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'directory', sourcePath: '/home/user/my-project' },
        files: [
          {
            path: 'src/app.ts',
            changeType: 'added',
            viewed: true,
            comments: [
              {
                id: 'dir-1',
                filePath: 'src/app.ts',
                lineRange: { side: 'new', start: 1, end: 5 },
                body: 'Directory review comment',
                category: 'note',
                suggestion: null,
              },
            ],
          },
        ],
      };

      const xml = await serializeReview(original, '/tmp/test-review.xml');
      const parsed = parseReviewXmlString(xml);

      expect(parsed.source).toEqual({
        type: 'directory',
        sourcePath: '/home/user/my-project',
      });
      expect(parsed.comments).toHaveLength(1);
      expect(parsed.comments[0].body).toBe('Directory review comment');
      expect(parsed.gitDiffArgs).toBe('');
    });

    it('round-trip with welcome source', async () => {
      const original: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'welcome' },
        files: [],
      };

      const xml = await serializeReview(original, '/tmp/test-review.xml');
      const parsed = parseReviewXmlString(xml);

      expect(parsed.source).toEqual({ type: 'welcome' });
    });

    it('round-trip with file-level comment', async () => {
      const original: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: 'main', repository: '/repo' },
        files: [
          {
            path: 'README.md',
            changeType: 'modified',
            viewed: true,
            comments: [
              {
                id: 'file-comment',
                filePath: 'README.md',
                lineRange: null,
                body: 'Overall documentation looks good',
                category: 'praise',
                suggestion: null,
              },
            ],
          },
        ],
      };

      const xml = await serializeReview(original, '/tmp/test-review.xml');
      const parsed = parseReviewXmlString(xml);

      expect(parsed.comments).toHaveLength(1);
      expect(parsed.comments[0].lineRange).toBeNull();
      expect(parsed.comments[0].body).toBe('Overall documentation looks good');
    });

    it('round-trip with old line range', async () => {
      const original: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: 'HEAD~1', repository: '/repo' },
        files: [
          {
            path: 'src/deleted.ts',
            changeType: 'modified',
            viewed: false,
            comments: [
              {
                id: 'old-line',
                filePath: 'src/deleted.ts',
                lineRange: { side: 'old', start: 10, end: 15 },
                body: 'Why delete this?',
                category: 'question',
                suggestion: null,
              },
            ],
          },
        ],
      };

      const xml = await serializeReview(original, '/tmp/test-review.xml');
      const parsed = parseReviewXmlString(xml);

      expect(parsed.comments[0].lineRange).toEqual({
        side: 'old',
        start: 10,
        end: 15,
      });
    });

    it('round-trip with special characters', async () => {
      const original: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [
          {
            path: 'src/test.ts',
            changeType: 'modified',
            viewed: true,
            comments: [
              {
                id: 'special',
                filePath: 'src/test.ts',
                lineRange: null,
                body: 'Use <Component> with & "quotes" and \'apostrophes\'',
                category: 'note',
                suggestion: {
                  originalCode: 'if (x < 5 && y > 10)',
                  proposedCode: 'if (x >= 5 || y <= 10)',
                },
              },
            ],
          },
        ],
      };

      const xml = await serializeReview(original, '/tmp/test-review.xml');
      const parsed = parseReviewXmlString(xml);

      expect(parsed.comments[0].body).toBe(
        'Use <Component> with & "quotes" and \'apostrophes\''
      );
      expect(parsed.comments[0].suggestion?.originalCode).toBe(
        'if (x < 5 && y > 10)'
      );
      expect(parsed.comments[0].suggestion?.proposedCode).toBe(
        'if (x >= 5 || y <= 10)'
      );
    });

    it('round-trip with multiple files and comments', async () => {
      const original: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        source: { type: 'git', gitDiffArgs: 'main..feature', repository: '/home/user/project' },
        files: [
          {
            path: 'src/file1.ts',
            changeType: 'modified',
            viewed: true,
            comments: [
              {
                id: 'c1',
                filePath: 'src/file1.ts',
                lineRange: { side: 'new', start: 1, end: 1 },
                body: 'Comment 1',
                category: 'note',
                suggestion: null,
              },
              {
                id: 'c2',
                filePath: 'src/file1.ts',
                lineRange: { side: 'new', start: 5, end: 10 },
                body: 'Comment 2',
                category: 'issue',
                suggestion: { originalCode: 'a', proposedCode: 'b' },
              },
            ],
          },
          {
            path: 'src/file2.ts',
            changeType: 'added',
            viewed: true,
            comments: [],
          },
          {
            path: 'src/file3.ts',
            changeType: 'deleted',
            viewed: false,
            comments: [
              {
                id: 'c3',
                filePath: 'src/file3.ts',
                lineRange: null,
                body: 'File comment',
                category: 'question',
                suggestion: null,
              },
            ],
          },
        ],
      };

      const xml = await serializeReview(original, '/tmp/test-review.xml');
      const parsed = parseReviewXmlString(xml);

      expect(parsed.comments).toHaveLength(3);
      expect(parsed.comments[0].filePath).toBe('src/file1.ts');
      expect(parsed.comments[1].filePath).toBe('src/file1.ts');
      expect(parsed.comments[2].filePath).toBe('src/file3.ts');
    });
  });

  describe('real-world scenarios', () => {
    it('parses complex review with mixed comment types', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="main..feature"
        repository="/home/user/project">
  <file path="src/components/Button.tsx" change-type="modified" viewed="true">
    <comment new-line-start="15" new-line-end="20">
      <body>Consider using a const for this value</body>
      <category>suggestion</category>
    </comment>
    <comment>
      <body>Overall structure looks good</body>
      <category>praise</category>
    </comment>
  </file>
  <file path="src/utils/helpers.ts" change-type="added" viewed="true" />
  <file path="src/legacy/old.ts" change-type="deleted" viewed="false">
    <comment old-line-start="10" old-line-end="10">
      <body>Why was this function removed?</body>
      <category>question</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(3);
      expect(result.comments[0].lineRange?.side).toBe('new');
      expect(result.comments[1].lineRange).toBeNull();
      expect(result.comments[2].lineRange?.side).toBe('old');
      expect(result.gitDiffArgs).toBe('main..feature');
    });

    it('handles multiple comments with suggestions', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/app.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>Fix bug</body>
      <category>bug</category>
      <suggestion>
        <original-code>const x = 1;</original-code>
        <proposed-code>const x = 2;</proposed-code>
      </suggestion>
    </comment>
    <comment new-line-start="20" new-line-end="25">
      <body>Refactor this</body>
      <category>suggestion</category>
      <suggestion>
        <original-code>function foo() {}</original-code>
        <proposed-code>const foo = () =&gt; {}</proposed-code>
      </suggestion>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].suggestion).toBeTruthy();
      expect(result.comments[1].suggestion).toBeTruthy();
      expect(result.comments[1].suggestion?.proposedCode).toBe(
        'const foo = () => {}'
      );
    });
  });

  describe('attachment parsing', () => {
    it('parses attachment elements into Attachment objects', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="test.ts" change-type="modified" viewed="true">
    <comment new-line-start="1" new-line-end="1">
      <body>test comment</body>
      <category>bug</category>
      <attachment path=".self-review-assets/img-001.png" media-type="image/png" />
    </comment>
  </file>
</review>`;
      const result = parseReviewXmlString(xml);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].attachments).toHaveLength(1);
      expect(result.comments[0].attachments![0].fileName).toBe('.self-review-assets/img-001.png');
      expect(result.comments[0].attachments![0].mediaType).toBe('image/png');
      expect(result.comments[0].attachments![0].data).toBeUndefined();
    });

    it('parses multiple attachments on a single comment', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="test.ts" change-type="modified" viewed="true">
    <comment new-line-start="1" new-line-end="1">
      <body>test</body>
      <category>bug</category>
      <attachment path=".self-review-assets/img-001.png" media-type="image/png" />
      <attachment path=".self-review-assets/img-002.jpg" media-type="image/jpeg" />
    </comment>
  </file>
</review>`;
      const result = parseReviewXmlString(xml);
      expect(result.comments[0].attachments).toHaveLength(2);
      expect(result.comments[0].attachments![0].mediaType).toBe('image/png');
      expect(result.comments[0].attachments![1].mediaType).toBe('image/jpeg');
    });

    it('handles XML without attachments (backward compatibility)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="test.ts" change-type="modified" viewed="true">
    <comment new-line-start="1" new-line-end="1">
      <body>test</body>
      <category>bug</category>
    </comment>
  </file>
</review>`;
      const result = parseReviewXmlString(xml);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].attachments).toBeUndefined();
    });
  });

  describe('reply parsing', () => {
    it('parses three replies in document order with authors preserved', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10" author="claude-opus-4">
      <body>This allocation looks unbounded.</body>
      <category>bug</category>
      <reply>
        <body>It is bounded by the caller, see line 4.</body>
      </reply>
      <reply author="claude-opus-4">
        <body>The caller is public API, so the bound is not enforced.</body>
      </reply>
      <reply>
        <body>Fair. I will add a guard.</body>
      </reply>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);
      const replies = result.comments[0].replies;

      expect(Array.isArray(replies)).toBe(true);
      expect(replies).toHaveLength(3);
      // Document order is conversation order; nothing else orders a thread.
      expect(replies!.map(r => r.body)).toEqual([
        'It is bounded by the caller, see line 4.',
        'The caller is public API, so the bound is not enforced.',
        'Fair. I will add a guard.',
      ]);
      expect(replies!.map(r => r.author)).toEqual([
        undefined,
        'claude-opus-4',
        undefined,
      ]);
    });

    // fast-xml-parser collapses a lone repeated element into a bare object, so
    // the one-reply case is the one that silently yields a non-array. Asserting
    // only on length would pass for the wrong reason: `.length` on the raw
    // object is undefined, not an error.
    it('parses a single reply as a one-element array', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>Root comment</body>
      <category>question</category>
      <reply author="claude-opus-4">
        <body>Only turn in the thread</body>
      </reply>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);
      const replies = result.comments[0].replies;

      expect(Array.isArray(replies)).toBe(true);
      expect(replies).toHaveLength(1);
      expect(replies![0].body).toBe('Only turn in the thread');
      expect(replies![0].author).toBe('claude-opus-4');
    });

    it('leaves replies undefined when a comment has none', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>No thread here</body>
      <category>note</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      // Undefined, not [], matching how attachments already behaves.
      expect(result.comments[0].replies).toBeUndefined();
    });

    it('parses reply attachments with reply-scoped ids', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>Root comment</body>
      <category>bug</category>
      <attachment path=".self-review-assets/img-001.png" media-type="image/png" />
      <reply>
        <body>Here is the screenshot</body>
        <attachment path=".self-review-assets/img-002.png" media-type="image/png" />
        <attachment path=".self-review-assets/img-003.jpg" media-type="image/jpeg" />
      </reply>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);
      const comment = result.comments[0];
      const reply = comment.replies![0];

      expect(reply.attachments).toHaveLength(2);
      expect(reply.attachments![0]).toEqual({
        id: `${reply.id}-att-0`,
        fileName: '.self-review-assets/img-002.png',
        mediaType: 'image/png',
      });
      expect(reply.attachments![1].id).toBe(`${reply.id}-att-1`);
      expect(reply.attachments![1].mediaType).toBe('image/jpeg');
      // The comment keeps its own prefix, so the two id spaces never collide.
      expect(comment.attachments![0].id).toBe(`${comment.id}-att-0`);
      expect(comment.attachments![0].id).not.toBe(reply.attachments![0].id);
    });

    it('leaves reply attachments undefined when a reply has none', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>Root comment</body>
      <category>bug</category>
      <reply>
        <body>No image here</body>
      </reply>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments[0].replies![0].attachments).toBeUndefined();
    });

    // The parser is deliberately namespace-blind, which is what makes reading
    // older documents free. A v2 document carrying replies must parse the same.
    it('parses replies from a v2-namespaced document', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v2" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10" severity="major" confidence="high">
      <body>Root comment</body>
      <category>bug</category>
      <reply author="claude-opus-4">
        <body>Reply under a v2 namespace</body>
      </reply>
      <reply>
        <body>Second turn</body>
      </reply>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments[0].severity).toBe('major');
      expect(Array.isArray(result.comments[0].replies)).toBe(true);
      expect(result.comments[0].replies).toHaveLength(2);
      expect(result.comments[0].replies![0].body).toBe(
        'Reply under a v2 namespace'
      );
    });

    it('gives each reply in a thread a distinct id', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>Root comment</body>
      <category>note</category>
      <reply><body>one</body></reply>
      <reply><body>two</body></reply>
      <reply><body>three</body></reply>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);
      const ids = result.comments[0].replies!.map(r => r.id);

      // Generated in the same millisecond, so the random suffix is doing the work.
      expect(new Set(ids).size).toBe(3);
      ids.forEach(id => expect(typeof id).toBe('string'));
      expect(ids).not.toContain(result.comments[0].id);
    });

    it('parses replies on separate comments independently', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>First</body>
      <category>note</category>
      <reply><body>only on the first</body></reply>
    </comment>
    <comment new-line-start="20" new-line-end="20">
      <body>Second</body>
      <category>note</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].replies).toHaveLength(1);
      expect(result.comments[1].replies).toBeUndefined();
    });

    it('reads an empty reply body as an empty string', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>Root comment</body>
      <category>note</category>
      <reply><body></body></reply>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments[0].replies![0].body).toBe('');
    });

    it('preserves escaped entities in a reply body', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>Root comment</body>
      <category>note</category>
      <reply>
        <body>Use &lt;Component&gt; when a &amp;&amp; b</body>
      </reply>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments[0].replies![0].body).toBe(
        'Use <Component> when a && b'
      );
    });

    it('preserves leading and trailing whitespace in a reply body', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v3" timestamp="2026-01-01T00:00:00Z" git-diff-args="--staged" repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>Root comment</body>
      <category>note</category>
      <reply><body>  padded reply  </body></reply>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments[0].replies![0].body).toBe('  padded reply  ');
    });

    it('round-trips multiline reply body whitespace byte-identically', async () => {
      const replyBody = '  first line\n    fenced body  \nlast line\n';
      const original: ReviewState = {
        timestamp: '2026-01-01T00:00:00Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [
          {
            path: 'src/main.ts',
            changeType: 'modified',
            viewed: true,
            comments: [
              {
                id: 'comment-1',
                filePath: 'src/main.ts',
                lineRange: { side: 'new', start: 10, end: 10 },
                body: 'Root comment',
                category: 'note',
                suggestion: null,
                replies: [
                  {
                    id: 'reply-1',
                    body: replyBody,
                  },
                ],
              },
            ],
          },
        ],
      };

      const xml = await serializeReview(original, '/tmp/test-review.xml');
      const result = parseReviewXmlString(xml);

      expect(result.comments[0].replies![0].body).toBe(replyBody);
    });
  });

  describe('author attribute', () => {
    it('parses comment with author attribute', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10" author="alice">
      <body>Looks good</body>
      <category>praise</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].author).toBe('alice');
    });

    it('has undefined author when attribute is not present', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>No author</body>
      <category>note</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].author).toBeUndefined();
    });
  });

  describe('viewed attribute', () => {
    function xmlWithFiles(files: string): string {
      return `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
${files}
</review>`;
    }

    it('collects paths of files marked as viewed', () => {
      const result = parseReviewXmlString(
        xmlWithFiles(`  <file path="src/a.ts" change-type="modified" viewed="true" />
  <file path="src/b.ts" change-type="modified" viewed="false" />
  <file path="src/c.ts" change-type="added" viewed="true" />`)
      );

      expect(result.viewedFiles).toEqual(['src/a.ts', 'src/c.ts']);
    });

    it('treats a missing viewed attribute as not viewed', () => {
      const result = parseReviewXmlString(
        xmlWithFiles(`  <file path="src/a.ts" change-type="modified" />`)
      );

      expect(result.viewedFiles).toEqual([]);
    });

    it('collects viewed files that also carry comments', () => {
      const result = parseReviewXmlString(
        xmlWithFiles(`  <file path="src/a.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>Needs a test</body>
      <category>issue</category>
    </comment>
  </file>`)
      );

      expect(result.viewedFiles).toEqual(['src/a.ts']);
      expect(result.comments).toHaveLength(1);
    });

    it('treats an unrecognised viewed value as not viewed', () => {
      const result = parseReviewXmlString(
        xmlWithFiles(`  <file path="src/a.ts" change-type="modified" viewed="yes" />`)
      );

      expect(result.viewedFiles).toEqual([]);
    });
  });

  describe('severity and confidence attributes', () => {
    function xmlWithCommentAttrs(attrs: string): string {
      return `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v2"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10"${attrs}>
      <body>Body</body>
      <category>bug</category>
    </comment>
  </file>
</review>`;
    }

    it('parses severity and confidence', () => {
      const result = parseReviewXmlString(
        xmlWithCommentAttrs(' severity="critical" confidence="high"')
      );

      expect(result.comments[0].severity).toBe('critical');
      expect(result.comments[0].confidence).toBe('high');
    });

    it('parses each attribute independently of the other', () => {
      const severityOnly = parseReviewXmlString(xmlWithCommentAttrs(' severity="minor"'));
      expect(severityOnly.comments[0].severity).toBe('minor');
      expect(severityOnly.comments[0].confidence).toBeUndefined();

      const confidenceOnly = parseReviewXmlString(xmlWithCommentAttrs(' confidence="low"'));
      expect(confidenceOnly.comments[0].severity).toBeUndefined();
      expect(confidenceOnly.comments[0].confidence).toBe('low');
    });

    it('leaves both undefined when the attributes are absent', () => {
      const result = parseReviewXmlString(xmlWithCommentAttrs(''));

      expect(result.comments[0].severity).toBeUndefined();
      expect(result.comments[0].confidence).toBeUndefined();
    });

    // Undefined is the fail-safe reading, and it keeps the resumed review
    // serializable: the serializer validates its output against the XSD.
    it('drops values outside the enumeration instead of passing them through', () => {
      const result = parseReviewXmlString(
        xmlWithCommentAttrs(' severity="blocker" confidence="certain"')
      );

      expect(result.comments[0].severity).toBeUndefined();
      expect(result.comments[0].confidence).toBeUndefined();
    });

    it('parses a v1 document, which never carries the signals', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/main.ts" change-type="modified" viewed="true">
    <comment new-line-start="10" new-line-end="10">
      <body>Legacy comment</body>
      <category>bug</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].body).toBe('Legacy comment');
      expect(result.comments[0].severity).toBeUndefined();
      expect(result.comments[0].confidence).toBeUndefined();
    });
  });

  describe('generated IDs', () => {
    it('generates unique IDs for parsed comments', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/test.ts" change-type="modified" viewed="true">
    <comment>
      <body>Comment 1</body>
      <category>note</category>
    </comment>
    <comment>
      <body>Comment 2</body>
      <category>note</category>
    </comment>
    <comment>
      <body>Comment 3</body>
      <category>note</category>
    </comment>
  </file>
</review>`;

      const result = parseReviewXmlString(xml);

      expect(result.comments).toHaveLength(3);
      const ids = result.comments.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3); // All IDs should be unique
      ids.forEach(id => {
        expect(id).toBeTruthy();
        expect(typeof id).toBe('string');
      });
    });
  });
});
