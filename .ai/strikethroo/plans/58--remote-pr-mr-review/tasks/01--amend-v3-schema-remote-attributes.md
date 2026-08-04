---
id: 1
group: "schema"
dependencies: []
status: "pending"
created: 2026-08-04
skills:
  - xsd
  - typescript
complexity_score: 5
complexity_notes: "Touches schema, types, serializer, and parser, but they form one round-trip unit that cannot be split without an unverifiable intermediate state"
---
# Amend v3 schema additively and round-trip remote attributes

## Objective
Amend `self-review-v3.xsd` in place (both byte-identical copies) with optional remote
provenance attributes, extend the shared types, and make the serializer emit / parser read
them so a remote-enabled document round-trips losslessly while every existing v3 document
and every purely local review stays untouched.

## Skills Required
XSD authoring under the project's schema-sync discipline; TypeScript across
`@self-review/types` and `@self-review/core`.

## Acceptance Criteria
- [ ] `.agents/skills/self-review-apply/assets/self-review-v3.xsd` and the embedded
      `XSD_SCHEMA` string in `packages/core/src/xml-serializer.ts` both gain, byte-identically:
      optional root attributes `remote-url`, `remote-base-sha`, `remote-head-sha`,
      `remote-forge` (enumeration `github` | `gitlab`), and an optional `remote-id`
      attribute on `CommentType` and the reply type, each with inline XSD documentation.
- [ ] The namespace stays `urn:self-review:v3` (no v4); `self-review-v1.xsd` and
      `self-review-v2.xsd` are not touched.
- [ ] `ReviewState` (in `packages/types/src/index.ts`) gains optional remote provenance
      fields (`remoteUrl`, `remoteBaseSha`, `remoteHeadSha`, `remoteForge: 'github' | 'gitlab'`),
      and `ReviewComment` plus the reply type gain optional `remoteId: string`.
- [ ] The serializer emits the new attributes only when set (mirroring the
      severity/confidence pattern); a review with none of them set serializes byte-identically
      to the current output — proven by an explicit unit test.
- [ ] The parser reads the new attributes tolerantly and leaves them `undefined` when
      absent; a round-trip (serialize → parse → serialize) preserves all remote attributes,
      including `remote-id` on comments and replies — proven by unit tests.
- [ ] A backwards-compatibility test validates a fixture `review.xml` from the previous
      release (no remote attributes) against the amended embedded XSD and it passes.
- [ ] Verification: `npm run test:unit` passes, including `packages/core/src/xsd-schema.test.ts`
      (byte-identity sync) with zero failures.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The remote root attributes form a third mutually exclusive source shape alongside
  `git-diff-args`/`repository` and `source-path`. XSD 1.0 cannot enforce cross-attribute
  exclusivity, so document the exclusivity in the inline XSD documentation, exactly as the
  existing two shapes handle it.
- `author` semantics are untouched: display name only, absent means human. Remote identity
  never rides in `author`.
- Absent `remote-*` attributes must behave like absent severity/confidence: serializer omits,
  parser leaves undefined.

## Input Dependencies
None — first task, current codebase only.

## Output Artifacts
- Amended XSD (both copies), extended types in `@self-review/types`, serializer/parser
  support in `packages/core/src/xml-serializer.ts` and `packages/core/src/xml-parser.ts`.
- These are consumed by the thread mapper (task 6), the `fetch-comments` subcommand
  (task 7), and app remote mode (task 8).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `packages/core/src/xml-serializer.ts` to find `XSD_SCHEMA` and how
   severity/confidence are conditionally emitted; copy that pattern for the new attributes.
2. Edit the XSD once, then copy the exact bytes into both locations. Run
   `npx vitest run packages/core/src/xsd-schema.test.ts` early to confirm sync.
3. In the XSD, add the four root attributes to the review root element's attribute list and
   `remote-id` to `CommentType` and the reply complex type, all `use="optional"`. Add
   `xs:annotation`/`xs:documentation` for each describing purpose (provenance, drift
   detection, forward machinery for a future posting feature).
4. In `packages/types/src/index.ts` extend `ReviewState`, `ReviewComment`, and the reply
   interface (`CommentReply` or equivalent — check the actual name) with the optional fields.
   `src/shared/types.ts` re-exports from there, so the app sees them automatically.
5. Serializer: emit root attributes only when the corresponding `ReviewState` field is set;
   emit `remote-id` on `<comment>`/`<reply>` only when `remoteId` is set.
6. Parser: the parser is namespace-blind; read the attributes when present, leave undefined
   otherwise. No validation of their values on read (tolerant read, exactly like
   severity/confidence out-of-enum handling).
7. Tests (colocated, Vitest): byte-identical local output test (serialize a fixture state
   with no remote fields, compare against the pre-change expected string already used in
   existing serializer tests); round-trip test with all remote fields plus `remoteId` on a
   comment and a reply; fixture validation test for a pre-amendment v3 document against the
   amended schema (the serializer's XSD validation path can be reused for this).
8. Do NOT touch `AGENTS.md` freeze wording here — documentation is task 10.
</details>

