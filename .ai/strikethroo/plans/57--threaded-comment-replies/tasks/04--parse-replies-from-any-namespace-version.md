---
id: 4
group: "core-serialization"
dependencies: [2]
status: "completed"
created: 2026-07-31
skills:
  - typescript
  - vitest
complexity_score: 5
complexity_notes: "fast-xml-parser's array-or-single normalization makes the one-reply case look correct while being wrong; the attachment-parsing extraction has to stay id-prefix parameterized to avoid a second copy."
execution_profile: "standard-implementation"
---
# Parse replies from any namespace version

## Objective

Read `<reply>` elements into `ReviewComment.replies` inside `parseReviewXmlString`, extract the
inline attachment parsing into a prefix-parameterized helper shared by comments and replies, and keep
the parser namespace-blind so v1, v2 and v3 documents all continue to load.

## Skills Required

TypeScript and `fast-xml-parser` semantics; Vitest.

## Acceptance Criteria

- [ ] A document with three `<reply>` children yields `comment.replies` of length 3 **in document
      order**, with `author` preserved where present and `undefined` where absent, and bodies
      byte-identical to the source.
- [ ] A document with exactly **one** `<reply>` yields `comment.replies` of length 1, not an object
      and not a crash. This is the case `fast-xml-parser` breaks and it must have its own test.
- [ ] A comment with no `<reply>` children yields `replies === undefined`, not `[]`, matching how
      `attachments` already behaves. Asserted explicitly with `toBeUndefined()`.
- [ ] Reply attachments parse into `Attachment[]` with ids of the form `${reply.id}-att-${i}`.
- [ ] Attachment parsing exists in **one** place, called for both comments and replies, taking an id
      prefix.
- [ ] Existing `urn:self-review:v1` and `urn:self-review:v2` fixtures in
      `packages/core/src/xml-parser.test.ts` still pass unchanged — no namespace option is added to
      the `XMLParser` constructor.
- [ ] `npm run test:unit` passes in full and `npm run lint` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `packages/core/src/xml-parser.ts`.
- The parser must remain namespace-blind. Do not add `removeNSPrefix`, `ignoreNameSpace`, or any
  namespace-aware option to the `XMLParser` config. Namespace blindness is what makes reading older
  documents free, and it is a deliberate design decision, not an oversight.
- `id` values are generated with the existing `generateId()`; replies get their own ids on parse and
  those ids are never written back out.

## Input Dependencies

Task 2: the `Reply` type and `ReviewComment.replies`.

## Output Artifacts

A parser that loads threads from any schema version. Consumed by the React UI at resume time and by
task 11's resume round-trip scenarios.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

**1. Extract the attachment parse.** Today it is inline at `xml-parser.ts:96-110`. Replace with:

```ts
/**
 * Normalize and read `<attachment>` children.
 *
 * fast-xml-parser gives an object for one child and an array for several, so
 * every child list in this file goes through the same normalization. Returns
 * undefined rather than [] when there are none, matching the type contract.
 */
function parseAttachments(
  node: Record<string, unknown>,
  idPrefix: string
): Attachment[] | undefined {
  const raw = Array.isArray(node.attachment)
    ? node.attachment
    : node.attachment
      ? [node.attachment]
      : [];

  if (raw.length === 0) return undefined;

  return raw.map((att: Record<string, unknown>, i: number) => ({
    id: `${idPrefix}-att-${i}`,
    fileName: String(att['@_path'] || ''),
    mediaType: String(att['@_media-type'] || 'image/png'),
  }));
}
```

Import `Attachment` and `Reply` from `./types`.

**2. Add `parseReplies`:**

```ts
/**
 * Read `<reply>` children in document order.
 *
 * Document order is conversation order — there is no timestamp and no
 * identifier to sort by, so the array order returned here is the only
 * ordering signal that ever exists for a thread.
 */
function parseReplies(comment: Record<string, unknown>): Reply[] | undefined {
  const raw = Array.isArray(comment.reply)
    ? comment.reply
    : comment.reply
      ? [comment.reply]
      : [];

  if (raw.length === 0) return undefined;

  return raw.map((node: Record<string, unknown>) => {
    const id = generateId();
    const reply: Reply = {
      id,
      body: node.body !== undefined ? String(node.body) : '',
      author: node['@_author'] ? String(node['@_author']) : undefined,
    };

    const attachments = parseAttachments(node, id);
    if (attachments) reply.attachments = attachments;

    return reply;
  });
}
```

Note `generateId()` is `${Date.now()}-${Math.random()...}` — distinct per call, so three replies in
the same millisecond still get distinct ids. Verify that by asserting the three ids in a thread are
mutually distinct.

**3. Wire both into the comment loop.** Replace the inline attachment block with:

```ts
        const attachments = parseAttachments(comment, reviewComment.id);
        if (attachments) reviewComment.attachments = attachments;

        const replies = parseReplies(comment);
        if (replies) reviewComment.replies = replies;

        comments.push(reviewComment);
```

Conditional assignment, not unconditional — `replies: undefined` as an own property would still be
`undefined` when read, but assigning only when present keeps the object shape identical to today for
reply-free documents, which several existing tests compare structurally.

**4. Tests** in `packages/core/src/xml-parser.test.ts`. Follow the file's existing fixture style
(template-literal XML strings passed to `parseReviewXmlString`). Add at minimum:

```ts
it('parses three replies in document order with authors preserved', ...)
it('parses a single reply as a one-element array', ...)   // the fast-xml-parser trap
it('leaves replies undefined when a comment has none', ...)
it('parses reply attachments with reply-scoped ids', ...)
it('parses replies from a v2-namespaced document', ...)   // namespace blindness
it('gives each reply in a thread a distinct id', ...)
```

For the single-reply test, the assertion that catches the bug is
`expect(Array.isArray(comments[0].replies)).toBe(true)` — a naive implementation returns the raw
object and `.length` is `undefined` rather than throwing, so asserting only on `.length` passes for
the wrong reason.

**Verification:**

```bash
npm run test:unit && npm run lint
```

</details>
