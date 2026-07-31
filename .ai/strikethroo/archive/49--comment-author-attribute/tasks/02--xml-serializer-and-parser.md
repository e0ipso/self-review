---
id: 2
group: "comment-author-attribute"
dependencies: [1]
status: "completed"
created: 2026-04-03
skills:
  - typescript
  - xml-processing
---
# XML Serializer and Parser Update

## Objective

Update the XML serializer to emit `author="..."` on comment elements when present, and update the XML parser to extract the `author` attribute from parsed comments.

## Skills Required

- TypeScript
- XML serialization/parsing with fast-xml-parser

## Acceptance Criteria

- [ ] `buildCommentXml` in `packages/core/src/xml-serializer.ts` emits `author="..."` when `comment.author` is defined and non-empty
- [ ] `buildCommentXml` omits the `author` attribute when `comment.author` is undefined or empty
- [ ] XML parser in `packages/core/src/xml-parser.ts` extracts `@_author` and assigns it to `ReviewComment.author`
- [ ] Comments without `author` attribute parse with `author` as `undefined`
- [ ] Existing unit tests pass
- [ ] New unit tests cover serialization and parsing of the `author` attribute

## Technical Requirements

- Files to modify:
  - `packages/core/src/xml-serializer.ts` (buildCommentXml function)
  - `packages/core/src/xml-parser.ts` (comment parsing logic)
- Corresponding test files should be updated with author attribute test cases

## Input Dependencies

Task 01 must be completed (XSD and types updated).

## Output Artifacts

- Updated serializer that emits `author` attribute
- Updated parser that reads `author` attribute
- Unit tests for both directions
