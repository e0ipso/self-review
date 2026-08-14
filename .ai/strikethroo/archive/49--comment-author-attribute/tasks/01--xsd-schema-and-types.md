---
id: 1
group: "comment-author-attribute"
dependencies: []
status: "completed"
created: 2026-04-03
skills:
  - xsd-schema
  - typescript
---
# XSD Schema and TypeScript Types Update

## Objective

Add the optional `author` attribute to the XSD schema (both copies) and the `ReviewComment` TypeScript interface, establishing the data contract for all downstream layers.

## Skills Required

- XSD schema authoring
- TypeScript interfaces

## Acceptance Criteria

- [ ] `CommentType` in `.claude/skills/self-review-apply/assets/self-review-v1.xsd` has an optional `author` attribute of type `xs:string`
- [ ] The embedded XSD in `packages/core/src/xml-serializer.ts` has the same `author` attribute added
- [ ] Both XSD copies are identical in their `CommentType` definition
- [ ] `ReviewComment` in `packages/types/src/index.ts` has an optional `author?: string` property
- [ ] No TypeScript compilation errors

## Technical Requirements

- Files to modify:
  - `.claude/skills/self-review-apply/assets/self-review-v1.xsd`
  - `packages/core/src/xml-serializer.ts` (embedded XSD string only)
  - `packages/types/src/index.ts`
- The attribute must be optional (both in XSD and TypeScript) for backwards compatibility

## Input Dependencies

None — this task is self-contained.

## Output Artifacts

- Updated XSD schema with `author` attribute
- Updated `ReviewComment` interface with `author` field

## Implementation Notes

Add `<xs:attribute name="author" type="xs:string" use="optional"/>` to the `CommentType` complex type in both XSD locations. Add `author?: string` to the `ReviewComment` interface in `packages/types/src/index.ts`.
