---
id: 4
group: "data-layer"
dependencies: [1]
status: "completed"
created: "2026-02-16"
skills:
  - typescript
  - xml
---

# Update XSD Schema, XML Serializer, and XML Parser for Directory Mode

## Objective

Make the XML output schema and serialization/parsing code support both git mode (with `git-diff-args` and `repository`) and directory mode (with `source-path`). Update the XSD, serializer, and parser together.

## Skills Required

- TypeScript, XML/XSD schema design

## Acceptance Criteria

- [ ] XSD at `.claude/skills/self-review-apply/assets/self-review-v1.xsd` has `git-diff-args` and `repository` as optional
- [ ] XSD has new optional `source-path` attribute
- [ ] Embedded XSD string in `xml-serializer.ts` matches the file exactly
- [ ] Serializer emits `git-diff-args`/`repository` only for `source.type === 'git'`
- [ ] Serializer emits `source-path` only for `source.type === 'directory'`
- [ ] Parser (`xml-parser.ts`) reads whichever attributes are present and constructs the correct `DiffSource` variant
- [ ] Existing XML serializer unit tests pass (updated for new type shape)
- [ ] New unit tests cover directory mode serialization and parsing
- [ ] XML output validates against the updated XSD in both modes

## Technical Requirements

- XSD changes: `use="required"` → `use="optional"` for `git-diff-args` and `repository`; add `source-path` with `use="optional"`
- Serializer must use `source.type` discriminant to decide which attributes to emit
- Parser must detect which attributes are present and construct `{ type: 'git', ... }` or `{ type: 'directory', ... }` accordingly

## Input Dependencies

- Task 1: `DiffSource` type must be defined in `types.ts`

## Output Artifacts

- Updated `.claude/skills/self-review-apply/assets/self-review-v1.xsd`
- Updated `src/main/xml-serializer.ts`
- Updated `src/main/xml-parser.ts`
- Updated unit tests for both

## Implementation Notes

<details>

1. **Update the XSD file** at `.claude/skills/self-review-apply/assets/self-review-v1.xsd`:
   - Find the `git-diff-args` attribute definition, change `use="required"` to `use="optional"`
   - Find the `repository` attribute definition, change `use="required"` to `use="optional"`
   - Add a new attribute: `<xs:attribute name="source-path" type="xs:string" use="optional"/>`
   - Add XSD documentation annotations explaining when each attribute is present

2. **Update the embedded XSD in `xml-serializer.ts`**: The serializer likely has the XSD as an inline string for validation. Find it and make identical changes. Both copies MUST match exactly.

3. **Update `xml-serializer.ts`** serialization logic:
   - Where `git-diff-args` and `repository` attributes are emitted, wrap in a check:
     ```typescript
     if (source.type === 'git') {
       // emit git-diff-args and repository
     } else if (source.type === 'directory') {
       // emit source-path
     }
     // welcome mode: emit neither (shouldn't normally serialize)
     ```
   - The `source` comes from `ReviewState.source`

4. **Update `xml-parser.ts`** parsing logic:
   - Where `git-diff-args` and `repository` are read from XML, detect which attributes exist:
     ```typescript
     if (gitDiffArgs && repository) {
       source = { type: 'git', gitDiffArgs, repository };
     } else if (sourcePath) {
       source = { type: 'directory', sourcePath };
     }
     ```
   - Set the parsed `source` on the returned `ReviewState`

5. **Update existing unit tests** in `xml-serializer.test.ts` and `xml-parser.test.ts`:
   - Change test fixtures to use `source: { type: 'git', gitDiffArgs: '...', repository: '...' }`
   - Add new test cases for directory mode serialization/parsing
   - Verify round-trip: serialize directory mode → parse → verify `DiffSource` matches

6. **Run all unit tests**: `npm run test:unit:main`

</details>
