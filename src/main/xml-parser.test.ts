import { describe, it, expect, vi } from 'vitest';
import { parseReviewXmlString, parseReviewXml } from './xml-parser';
import { serializeReview } from './xml-serializer';
import type {
  ReviewState,
  FileReviewState,
  ReviewComment,
} from '../shared/types';
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
        gitDiffArgs: '--staged',
        repository: '/repo',
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
      expect(parsed.gitDiffArgs).toBe(original.gitDiffArgs);
    });

    it('round-trip with file-level comment', async () => {
      const original: ReviewState = {
        timestamp: '2024-01-15T10:30:00Z',
        gitDiffArgs: 'main',
        repository: '/repo',
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
        gitDiffArgs: 'HEAD~1',
        repository: '/repo',
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
        gitDiffArgs: '--staged',
        repository: '/repo',
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
        gitDiffArgs: 'main..feature',
        repository: '/home/user/project',
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
