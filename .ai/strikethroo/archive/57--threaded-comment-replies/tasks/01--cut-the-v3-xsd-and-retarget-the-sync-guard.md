---
id: 1
group: "schema-contract"
dependencies: []
status: "completed"
created: 2026-07-31
skills:
  - xsd
  - typescript
complexity_score: 6
complexity_notes: "Two synced copies of a 450-line schema plus three test files must move together or the unit suite goes red; the schema text itself is the LLM-facing specification, so its annotations are load-bearing content, not boilerplate."
execution_profile: "complex-architecture"
---
# Cut `self-review-v3.xsd` and retarget the sync guard

## Objective

Create the canonical `self-review-v3.xsd`, keep the embedded `XSD_SCHEMA` string byte-identical to
it, switch the serializer to emit and validate `urn:self-review:v3`, and retarget `xsd-schema.test.ts`
and `xml-serializer.test.ts` at v3 — leaving the unit suite green with no reply *behaviour* yet.

## Skills Required

XSD 1.0 authoring (complex types, annotations, `maxOccurs="unbounded"` sequences) and TypeScript for
the embedded template literal and the test constants.

## Acceptance Criteria

- [ ] `.agents/skills/self-review-apply/assets/self-review-v3.xsd` exists, declares
      `targetNamespace="urn:self-review:v3"` and `xmlns:sr="urn:self-review:v3"`, defines a
      `ReplyType` complex type, and appends `<xs:element name="reply" type="sr:ReplyType"
      minOccurs="0" maxOccurs="unbounded" />` as the **last** element of `CommentType`'s sequence.
- [ ] `git status --porcelain .agents/skills/self-review-apply/assets/self-review-v1.xsd
      .agents/skills/self-review-apply/assets/self-review-v2.xsd` prints nothing — both older schemas
      are untouched on disk.
- [ ] `packages/core/src/xml-serializer.ts` emits `xmlns="urn:self-review:v3"` and passes
      `fileName: 'self-review-v3.xsd'` to `validateXML`.
- [ ] `npm run test:unit` passes in full. In particular `packages/core/src/xsd-schema.test.ts`
      passes with `CANONICAL_SCHEMA` and `SCHEMA_FILE_NAME` pointing at v3, and its byte-equality
      assertion `readCopy(CANONICAL_SCHEMA) === \`${XSD_SCHEMA}\n\`` holds.
- [ ] `xsd-schema.test.ts` retains a negative test proving the bump is observable: a document
      declaring `urn:self-review:v2` fails validation against the v3 schema.
- [ ] `npm run lint` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- The canonical file and the `XSD_SCHEMA` template literal in
  `packages/core/src/xml-serializer.ts` must be byte-identical except that the on-disk file ends with
  exactly one trailing newline. This is asserted verbatim by `xsd-schema.test.ts:55`.
- `xmllint-wasm` validates the serializer output in `xsd-schema.test.ts`; it runs for real there
  (`xml-serializer.test.ts` mocks it away).
- The schema is fed to LLMs as the specification. Annotations are the deliverable, not decoration.

## Input Dependencies

None. This task starts from the current `self-review-v2.xsd`.

## Output Artifacts

- `.agents/skills/self-review-apply/assets/self-review-v3.xsd` (canonical contract, consumed by
  tasks 3, 8 and 9).
- Updated `XSD_SCHEMA` in `packages/core/src/xml-serializer.ts` (consumed by task 3).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

**1. Create the canonical schema.**

```bash
cp .agents/skills/self-review-apply/assets/self-review-v2.xsd \
   .agents/skills/self-review-apply/assets/self-review-v3.xsd
```

Then edit only `self-review-v3.xsd`. Never edit v1 or v2 — they are frozen.

**2. Change the namespace.** In the `<xs:schema>` header, replace both occurrences:

```xml
  xmlns:sr="urn:self-review:v3"
  targetNamespace="urn:self-review:v3"
```

**3. Update the header comment.** Change `self-review XML Schema v2` to `v3`, add `- A <comment> may
carry an ordered list of <reply> children, which are turns in a conversation about that comment.` to
the "Key concepts" list, and append a `Changes from v2:` block directly after the existing
`Changes from v1:` block (keep the v1 block, it is history):

```
    Changes from v2:
    - <comment> gained an optional, unbounded <reply> child, so a finding
      and the responses to it form a single legible thread instead of a
      set of disconnected assertions. See ReplyType.
```

**4. Append `<reply>` to `CommentType`'s sequence.** It goes *after* the existing `<xs:element
name="attachment" ...>`, as the last entry of the `<xs:sequence>`:

```xml
      <xs:element name="reply" type="sr:ReplyType" minOccurs="0" maxOccurs="unbounded">
        <xs:annotation>
          <xs:documentation>
            Optional ordered list of replies to this comment. The comment
            itself is the root of the thread; each reply is a later turn in
            the conversation about it.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
```

**5. Add `ReplyType`.** Place it immediately after `CommentType` and before `SuggestionType`. The
annotation must state all four load-bearing rules explicitly, because the XSD is the specification
handed to LLMs:

```xml
  <xs:complexType name="ReplyType">
    <xs:annotation>
      <xs:documentation>
        A reply to a review comment. Replies turn a finding into a
        conversation: the comment asserts something, a reply answers it, a
        later reply answers that.

        Four rules govern replies, and none of them can be expressed in
        XSD 1.0, so they are stated here and enforced by the application
        and by the skills that author these documents:

        1. Replies are ordered. Document order is conversation order, and
           it is the only ordering signal. There are no timestamps and no
           identifiers: the earlier reply is the earlier turn.

        2. Replies are flat. A reply is never nested inside another reply.
           A reply that addresses an earlier reply says so in its body.

        3. A reply carries no thresholding metadata. There is no category,
           no severity and no confidence on a reply. Those are properties
           of the finding, and the finding is the root comment, whose
           severity and confidence govern the whole thread.

        4. A reply carries no suggestion. A concrete counter-proposal goes
           in the reply body as a fenced code block. Allowing a suggestion
           on both the root and a reply would force every consumer to
           invent its own precedence rule.

        When a machine consumes a thread, the last human turn is the
        tie-breaker over any earlier machine assertion.
      </xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="body" type="xs:string">
        <xs:annotation>
          <xs:documentation>
            The reply text. May contain markdown formatting, including
            fenced code blocks, which is where a counter-proposal goes
            since replies carry no suggestion element.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
      <xs:element name="attachment" type="sr:AttachmentType" minOccurs="0" maxOccurs="unbounded">
        <xs:annotation>
          <xs:documentation>
            Optional image attachment, identical in form and semantics to
            a comment attachment. The path attribute references an image
            file stored in the .self-review-assets/ directory alongside
            the XML output.
          </xs:documentation>
        </xs:annotation>
      </xs:element>
    </xs:sequence>
    <xs:attribute name="author" type="xs:string" use="optional">
      <xs:annotation>
        <xs:documentation>
          The author of this reply, with the same semantics as
          CommentType/@author. When present, the reply was generated by a
          bot or LLM (e.g., "Claude Opus 5"). When absent, the reply is
          the human reviewer's.
        </xs:documentation>
      </xs:annotation>
    </xs:attribute>
  </xs:complexType>
```

**6. Sync the embedded copy.** Replace the `XSD_SCHEMA` template literal in
`packages/core/src/xml-serializer.ts` with the exact contents of the new file, minus the single
trailing newline. The safest way is to regenerate it mechanically rather than hand-editing both.
Beware: the schema text contains no backticks or `${`, so it drops into a template literal
unescaped — verify that assumption holds after your edits.

Also update the comment above `XSD_SCHEMA` if it names v2.

**7. Flip the serializer.** Two lines:

- `xml-serializer.ts:504` → `schema: [{ fileName: 'self-review-v3.xsd', contents: XSD_SCHEMA }]`
- `xml-serializer.ts:551` → `<review xmlns="urn:self-review:v3" ...`

**8. Retarget `packages/core/src/xsd-schema.test.ts`.**

- `CANONICAL_SCHEMA` → `.agents/skills/self-review-apply/assets/self-review-v3.xsd`
- `SCHEMA_FILE_NAME` → `self-review-v3.xsd`
- `reviewXml()` helper → `urn:self-review:v3`
- The `rejects a v1-namespaced document` test → rewrite it to replace `urn:self-review:v3` with
  `urn:self-review:v2` and rename it to `rejects a v2-namespaced document, so the version bump is
  observable`. Keeping a bump-is-observable test is required; changing which older namespace it
  targets is the point.
- The final serializer test asserts `xmlns="urn:self-review:v2"` → change to v3, and rename the
  test accordingly.

**9. Retarget `packages/core/src/xml-serializer.test.ts`.** Three assertions reference v2 and will
fail otherwise:

- line ~45: `expect(xml).toContain('xmlns="urn:self-review:v2"')` → v3
- line ~493: `expect(callArgs.schema[0].fileName).toBe('self-review-v2.xsd')` → v3
- line ~528: `expect(xml).toContain('xmlns="urn:self-review:v2"')` → v3

Grep for `self-review:v2` and `self-review-v2.xsd` under `packages/` before finishing to confirm you
caught them all. Leave `xml-parser.test.ts` alone: its v1/v2 fixtures are deliberate proof that the
parser is namespace-blind.

**Out of scope for this task, do not touch:** `AGENTS.md`, `README.md`, `docs/PRD.md`, either
`SKILL.md`, `tests/features/07-xml-output.feature`, `tests/fixtures/test-repo.ts`. They are owned by
tasks 8, 9 and 11 and will be inconsistent until then. That is expected.

**Verification command:**

```bash
npm run test:unit && npm run lint
```

</details>
