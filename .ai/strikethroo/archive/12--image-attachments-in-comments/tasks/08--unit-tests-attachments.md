---
id: 8
group: "testing"
dependencies: [3, 4, 5]
status: "completed"
created: "2026-02-16"
skills: ["vitest", "typescript"]
---

# Unit Tests for Attachment Serialization, Parsing, and State Management

## Objective

Add unit tests covering the critical business logic for image attachments: XML serialization with attachments, XML parsing of attachment elements, and renderer state management for adding/removing attachments.

## Skills Required

- `vitest`: Test structure, assertions, mocking
- `typescript`: Type-safe test fixtures

## Acceptance Criteria

- [ ] XML serializer tests verify `<attachment>` elements are emitted correctly with path and media-type attributes
- [ ] XML serializer tests verify image files are written to `.self-review-assets/` directory
- [ ] XML serializer tests verify no asset directory is created when no attachments exist
- [ ] XML parser tests verify `<attachment>` elements are parsed into `Attachment` objects on `ReviewComment`
- [ ] XML parser tests verify backward compatibility (XML without attachments parses without errors)
- [ ] Renderer state tests verify adding and removing attachments from comments
- [ ] All tests pass with `npm run test:unit`

## Technical Requirements

- Colocate tests with source files (e.g., `xml-serializer.test.ts` next to `xml-serializer.ts`)
- Mock `fs` for serializer tests (don't write actual files)
- Use fixture strings for parser tests (real XML samples with and without attachments)
- Follow existing test patterns in the codebase

### Meaningful Test Strategy Guidelines

Your critical mantra: "write a few tests, mostly integration".

**What TO test:**
- Custom serialization logic for attachments (file writing, XML emission, path generation)
- Parsing logic for attachment elements (attribute extraction, backward compatibility)
- State transitions for attachment CRUD in the review hook

**What NOT to test:**
- `fs.writeFileSync` itself (Node.js built-in)
- `URL.createObjectURL` (browser API)
- XML DOM parsing library internals
- React component rendering of images (visual, better suited for E2E)

## Input Dependencies

- Task 3: XML serializer implementation to test
- Task 4: XML parser implementation to test
- Task 5: CommentInput state management to test

## Output Artifacts

- New or updated `src/main/xml-serializer.test.ts`
- New or updated `src/main/xml-parser.test.ts`
- New or updated `src/renderer/hooks/useReviewState.test.ts` (if attachment state logic is in the hook)

## Implementation Notes

<details>

### Step 1: Read existing test files

Read the existing test files to understand patterns:
- `src/main/xml-serializer.test.ts` (if it exists)
- `src/main/xml-parser.test.ts` (if it exists)
- `src/main/diff-parser.test.ts` (for main process test patterns)
- Any renderer test files for hook testing patterns

### Step 2: Serializer tests

Add tests for attachment serialization:

```typescript
describe('attachment serialization', () => {
  it('emits attachment elements with path and media-type', () => {
    const review = createReviewWithAttachment();
    const xml = serializeReview(review, outputPath);
    expect(xml).toContain('<attachment path=".self-review-assets/');
    expect(xml).toContain('media-type="image/png"');
  });

  it('writes image files to .self-review-assets directory', () => {
    // Mock fs.writeFileSync and fs.mkdirSync
    // Verify they were called with correct paths and data
  });

  it('skips asset directory when no attachments exist', () => {
    const review = createReviewWithoutAttachments();
    serializeReview(review, outputPath);
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});
```

### Step 3: Parser tests

Add tests for attachment parsing:

```typescript
describe('attachment parsing', () => {
  it('parses attachment elements into Attachment objects', () => {
    const xml = `<comment ...>
      <body>test</body>
      <attachment path=".self-review-assets/c1-0.png" media-type="image/png" />
    </comment>`;
    const comments = parseReview(xml);
    expect(comments[0].attachments).toHaveLength(1);
    expect(comments[0].attachments![0].mediaType).toBe('image/png');
  });

  it('handles XML without attachment elements (backward compatibility)', () => {
    const xml = `<comment ...><body>test</body></comment>`;
    const comments = parseReview(xml);
    expect(comments[0].attachments).toBeUndefined();
  });
});
```

### Step 4: State management tests

If attachment state is managed in `useReviewState`, test the add/remove operations:

```typescript
describe('attachment state management', () => {
  it('adds attachment to comment', () => {
    // Test that addComment with attachments stores them correctly
  });

  it('removes attachment from comment', () => {
    // Test that editing a comment can remove attachments
  });
});
```

### Step 5: Run tests

Run `npm run test:unit` to verify all tests pass.

</details>
