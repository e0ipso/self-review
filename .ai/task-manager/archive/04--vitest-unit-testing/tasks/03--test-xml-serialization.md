---
id: 3
group: "priority-tests"
dependencies: [1]
status: "completed"
created: "2026-02-12"
completed: "2026-02-12"
skills:
  - vitest
  - typescript
---
# Test XML Serializer and Parser Modules

## Objective

Write comprehensive unit tests for the XML serialization and parsing modules (`xml-serializer.ts` and `xml-parser.ts`), which convert review state to/from XML format. These are priority modules critical for the application's output format and resume functionality.

## Skills Required

- **vitest**: Write test suites with mocking for WASM dependencies
- **typescript**: Test complex data structures and XML validation logic

## Acceptance Criteria

- [ ] Test file created at `src/main/xml-serializer.test.ts`
- [ ] Test file created at `src/main/xml-parser.test.ts`
- [ ] Tests cover serialization: empty reviews, reviews with comments, file/line-level comments, suggestions
- [ ] Tests cover parsing: valid XML, malformed XML, missing fields, line ranges
- [ ] Tests verify XSD schema validation (or mock if WASM loading is problematic)
- [ ] Tests include round-trip validation: serialize → parse → should match original
- [ ] Tests verify XML character escaping (special chars like <, >, &, quotes)
- [ ] All tests pass with `npm run test:unit:main`
- [ ] Test suite contributes to 50-60% coverage target

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

### Modules to Test

**Files**:
- `src/main/xml-serializer.ts`: `serializeReviewToXML(reviewState: ReviewState): string`
- `src/main/xml-parser.ts`: `parseReviewXML(xml: string): ReviewComment[]`

### Test Structure

#### xml-serializer.test.ts

```typescript
describe('serializeReviewToXML', () => {
  describe('basic serialization', () => {
    it('serializes empty review with required attributes');
    it('serializes review with single file and no comments');
    it('includes timestamp, git-diff-args, and repository attributes');
  });

  describe('comments', () => {
    it('serializes file-level comments (no line range)');
    it('serializes line-level comments with newLineStart/End');
    it('serializes line-level comments with oldLineStart/End');
    it('serializes comments with suggestions');
    it('escapes special XML characters in comment body');
  });

  describe('validation', () => {
    it('produces valid XML structure');
    it('validates against XSD schema (if feasible)');
  });
});
```

#### xml-parser.test.ts

```typescript
describe('parseReviewXML', () => {
  describe('basic parsing', () => {
    it('parses empty review (no files)');
    it('parses single comment with all fields');
    it('extracts file path, body, and category correctly');
  });

  describe('line ranges', () => {
    it('parses newLineStart/newLineEnd for added lines');
    it('parses oldLineStart/oldLineEnd for deleted lines');
    it('handles file-level comments (no line attributes)');
  });

  describe('suggestions', () => {
    it('parses suggestion blocks with oldCode and newCode');
  });

  describe('error handling', () => {
    it('rejects malformed XML');
    it('handles missing optional fields gracefully');
  });

  describe('round-trip', () => {
    it('serialize → parse yields equivalent data');
  });
});
```

### XML Fixture Examples

**Empty Review**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/path/to/repo">
</review>
```

**Review with File-Level Comment**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/path/to/repo">
  <file path="src/main.ts" viewed="true">
    <comment category="question">
      <body>Why was this approach chosen?</body>
    </comment>
  </file>
</review>
```

**Review with Line-Level Comment and Suggestion**:
```xml
<file path="src/utils.ts" viewed="false">
  <comment category="issue" newLineStart="42" newLineEnd="45">
    <body>This logic seems incorrect</body>
    <suggestion>
      <oldCode>const x = foo();</oldCode>
      <newCode>const x = bar();</newCode>
    </suggestion>
  </comment>
</file>
```

## Input Dependencies

- Task 1: Vitest infrastructure must be set up
- `src/main/xml-serializer.ts`: Serializer module to test
- `src/main/xml-parser.ts`: Parser module to test
- `src/shared/types.ts`: Type definitions for `ReviewState`, `ReviewComment`, `Suggestion`
- `xmllint-wasm` package (may need mocking if WASM loading is problematic in tests)

## Output Artifacts

- `src/main/xml-serializer.test.ts`: Comprehensive test suite for XML serialization
- `src/main/xml-parser.test.ts`: Comprehensive test suite for XML parsing
- Passing tests verifiable with `npm run test:unit:main`

## Implementation Notes

<details>
<summary>Testing Approach and XML Validation</summary>

**IMPORTANT**: Write a few tests, mostly integration. Focus on testing the core serialization/parsing logic and critical edge cases like character escaping and round-trip fidelity.

### Meaningful Test Strategy Guidelines

**Definition of "Meaningful Tests":**
Tests that verify custom business logic, critical paths, and edge cases specific to the application. Focus on testing YOUR code, not the framework or library functionality.

**When TO Write Tests:**
- Custom business logic and algorithms (✅ XML serialization/parsing is core logic)
- Critical user workflows and data transformations (✅ XML output is the primary deliverable)
- Edge cases and error conditions for core functionality (✅ malformed XML, character escaping)
- Integration points between different system components (✅ round-trip serialization/parsing)
- Complex validation logic or calculations (✅ XSD validation)

**When NOT to Write Tests:**
- Third-party library functionality (xmllint-wasm is already tested)
- Framework features
- Simple CRUD operations without custom logic
- Getter/setter methods or basic property access
- Obvious functionality that would break immediately if incorrect

### Example Test Implementation

```typescript
import { describe, it, expect, vi } from 'vitest';
import { serializeReviewToXML } from './xml-serializer';
import { parseReviewXML } from './xml-parser';
import type { ReviewState, FileReviewState, ReviewComment } from '../shared/types';

describe('serializeReviewToXML', () => {
  it('serializes empty review with required attributes', () => {
    const reviewState: ReviewState = {
      timestamp: new Date('2024-01-15T10:30:00Z'),
      gitDiffArgs: '--staged',
      repository: '/path/to/repo',
      files: [],
    };

    const xml = serializeReviewToXML(reviewState);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="urn:self-review:v1"');
    expect(xml).toContain('timestamp="2024-01-15T10:30:00Z"');
    expect(xml).toContain('git-diff-args="--staged"');
    expect(xml).toContain('repository="/path/to/repo"');
  });

  it('serializes file-level comment', () => {
    const file: FileReviewState = {
      path: 'src/main.ts',
      viewed: true,
      comments: [
        {
          id: '123',
          filePath: 'src/main.ts',
          lineRange: null, // File-level
          body: 'Overall looks good',
          category: 'praise',
          suggestion: null,
        },
      ],
    };

    const reviewState: ReviewState = {
      timestamp: new Date('2024-01-15T10:30:00Z'),
      gitDiffArgs: '--staged',
      repository: '/path/to/repo',
      files: [file],
    };

    const xml = serializeReviewToXML(reviewState);

    expect(xml).toContain('<file path="src/main.ts" viewed="true">');
    expect(xml).toContain('<comment category="praise">');
    expect(xml).toContain('<body>Overall looks good</body>');
    expect(xml).not.toContain('newLineStart');
    expect(xml).not.toContain('oldLineStart');
  });

  it('serializes line-level comment with line range', () => {
    const comment: ReviewComment = {
      id: '456',
      filePath: 'src/utils.ts',
      lineRange: { newLineStart: 10, newLineEnd: 12 },
      body: 'Consider refactoring',
      category: 'suggestion',
      suggestion: null,
    };

    const file: FileReviewState = {
      path: 'src/utils.ts',
      viewed: false,
      comments: [comment],
    };

    const reviewState: ReviewState = {
      timestamp: new Date('2024-01-15T10:30:00Z'),
      gitDiffArgs: 'HEAD~1',
      repository: '/repo',
      files: [file],
    };

    const xml = serializeReviewToXML(reviewState);

    expect(xml).toContain('<comment category="suggestion" newLineStart="10" newLineEnd="12">');
    expect(xml).toContain('<body>Consider refactoring</body>');
  });

  it('escapes special XML characters', () => {
    const comment: ReviewComment = {
      id: '789',
      filePath: 'test.ts',
      lineRange: null,
      body: 'Use <Component> with & symbol and "quotes"',
      category: 'note',
      suggestion: null,
    };

    const reviewState: ReviewState = {
      timestamp: new Date('2024-01-15T10:30:00Z'),
      gitDiffArgs: '--staged',
      repository: '/repo',
      files: [{ path: 'test.ts', viewed: false, comments: [comment] }],
    };

    const xml = serializeReviewToXML(reviewState);

    expect(xml).toContain('&lt;Component&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;');
  });

  it('serializes suggestion with old and new code', () => {
    const comment: ReviewComment = {
      id: '999',
      filePath: 'src/bug.ts',
      lineRange: { newLineStart: 42, newLineEnd: 42 },
      body: 'Fix the bug',
      category: 'bug',
      suggestion: {
        oldCode: 'const x = foo();',
        newCode: 'const x = bar();',
      },
    };

    const reviewState: ReviewState = {
      timestamp: new Date('2024-01-15T10:30:00Z'),
      gitDiffArgs: 'main',
      repository: '/repo',
      files: [{ path: 'src/bug.ts', viewed: false, comments: [comment] }],
    };

    const xml = serializeReviewToXML(reviewState);

    expect(xml).toContain('<suggestion>');
    expect(xml).toContain('<oldCode>const x = foo();</oldCode>');
    expect(xml).toContain('<newCode>const x = bar();</newCode>');
    expect(xml).toContain('</suggestion>');
  });
});

describe('parseReviewXML', () => {
  it('parses empty review', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
</review>`;

    const comments = parseReviewXML(xml);
    expect(comments).toEqual([]);
  });

  it('parses file-level comment', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="--staged"
        repository="/repo">
  <file path="src/main.ts" viewed="true">
    <comment category="question">
      <body>Why this approach?</body>
    </comment>
  </file>
</review>`;

    const comments = parseReviewXML(xml);

    expect(comments).toHaveLength(1);
    expect(comments[0].filePath).toBe('src/main.ts');
    expect(comments[0].category).toBe('question');
    expect(comments[0].body).toBe('Why this approach?');
    expect(comments[0].lineRange).toBeNull();
  });

  it('parses line-level comment with new line range', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="HEAD~1"
        repository="/repo">
  <file path="src/utils.ts" viewed="false">
    <comment category="issue" newLineStart="10" newLineEnd="15">
      <body>This needs fixing</body>
    </comment>
  </file>
</review>`;

    const comments = parseReviewXML(xml);

    expect(comments).toHaveLength(1);
    expect(comments[0].lineRange).toEqual({
      newLineStart: 10,
      newLineEnd: 15,
    });
  });

  it('parses suggestion block', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1"
        timestamp="2024-01-15T10:30:00Z"
        git-diff-args="main"
        repository="/repo">
  <file path="src/bug.ts" viewed="false">
    <comment category="bug" newLineStart="42" newLineEnd="42">
      <body>Fix this</body>
      <suggestion>
        <oldCode>const x = foo();</oldCode>
        <newCode>const x = bar();</newCode>
      </suggestion>
    </comment>
  </file>
</review>`;

    const comments = parseReviewXML(xml);

    expect(comments).toHaveLength(1);
    expect(comments[0].suggestion).toEqual({
      oldCode: 'const x = foo();',
      newCode: 'const x = bar();',
    });
  });

  it('handles malformed XML gracefully', () => {
    const malformedXml = '<review><file><comment></review>';

    expect(() => parseReviewXML(malformedXml)).toThrow();
  });

  describe('round-trip', () => {
    it('serialize then parse yields equivalent data', () => {
      const original: ReviewState = {
        timestamp: new Date('2024-01-15T10:30:00Z'),
        gitDiffArgs: '--staged',
        repository: '/repo',
        files: [
          {
            path: 'src/test.ts',
            viewed: true,
            comments: [
              {
                id: 'id-1',
                filePath: 'src/test.ts',
                lineRange: { newLineStart: 5, newLineEnd: 10 },
                body: 'Test comment',
                category: 'note',
                suggestion: {
                  oldCode: 'old',
                  newCode: 'new',
                },
              },
            ],
          },
        ],
      };

      const xml = serializeReviewToXML(original);
      const parsed = parseReviewXML(xml);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].filePath).toBe(original.files[0].comments[0].filePath);
      expect(parsed[0].body).toBe(original.files[0].comments[0].body);
      expect(parsed[0].category).toBe(original.files[0].comments[0].category);
      expect(parsed[0].lineRange).toEqual(original.files[0].comments[0].lineRange);
      expect(parsed[0].suggestion).toEqual(original.files[0].comments[0].suggestion);
    });
  });
});
```

### Handling xmllint-wasm in Tests

The `xmllint-wasm` dependency might have issues loading WASM files in the test environment. Options:

1. **Mock the validation**: If XSD validation is problematic, mock it:
```typescript
vi.mock('xmllint-wasm', () => ({
  validateXML: vi.fn(() => ({ valid: true })),
}));
```

2. **Skip validation in tests**: Focus on structure testing, not XSD compliance
3. **Integration test**: Have one test that validates real XML if WASM loads properly

### Tips

1. **Use Template Strings**: Store XML fixtures as template strings for readability
2. **Test Character Escaping**: Critical for security and correctness
3. **Round-Trip Testing**: Validates both serializer and parser work together
4. **Error Handling**: Test malformed XML to ensure graceful failures
5. **Don't Over-Test**: Focus on representative cases, not exhaustive combinations

### Running Tests

```bash
npm run test:unit:main -- xml-serializer.test.ts
npm run test:unit:main -- xml-parser.test.ts
npm run test:coverage -- src/main/xml-*.test.ts
```

</details>
