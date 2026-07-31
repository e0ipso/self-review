---
id: 3
group: "core-serialization"
dependencies: [1, 2]
status: "completed"
created: 2026-07-31
skills:
  - typescript
  - vitest
complexity_score: 6
complexity_notes: "The reply-attachment walk in writeAttachments is a separate code path from XML emission, so getting it wrong produces a schema-valid document referencing files that were never written — a failure with no error surface. Two extractions are mandated by AGENTS.md rather than optional."
execution_profile: "complex-architecture"
---
# Serialize replies and their attachments

## Objective

Emit `<reply>` children from `buildCommentXml`, extract the duplicated attachment-emission logic into
one helper, and extend `writeAttachments` to walk reply attachments so a reply's image blob actually
lands in `.self-review-assets/`.

## Skills Required

TypeScript (string-building serializer, immutable state mapping) and Vitest.

## Acceptance Criteria

- [ ] `buildCommentXml` emits `<reply>` elements after the comment's `<attachment>` elements, in
      `comment.replies` array order, each with `<body>` and optional `author` attribute and optional
      `<attachment>` children.
- [ ] Attachment element emission exists in **exactly one** place and is called from both the comment
      and reply paths. `grep -c '<attachment path=' packages/core/src/xml-serializer.ts` returns 1.
- [ ] `writeAttachments` walks `comment.replies[].attachments`, writes each blob to
      `.self-review-assets/`, and strips the in-memory `data` buffer — same as it does for comment
      attachments.
- [ ] A new test in `packages/core/src/xml-serializer.test.ts` serializes a review whose **only**
      attachment hangs off a reply, and asserts the written asset file exists on disk. This test must
      fail if the `writeAttachments` reply walk is removed — verify that by temporarily reverting the
      walk and watching it go red.
- [ ] A new test in `packages/core/src/xsd-schema.test.ts` runs `serializeReview` on a comment with
      three replies (mixed authored and unauthored) and asserts the output validates against the real
      v3 schema, with the three `<reply>` elements in the given order.
- [ ] A test asserts a reply body containing a fenced code block with `<`, `>` and `&` round-trips
      through `escapeXml` — the output contains `&lt;`/`&amp;` and no raw angle brackets inside the
      body.
- [ ] `npm run test:unit` passes in full and `npm run lint` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `packages/core/src/xml-serializer.ts`. Indentation in this file is literal two-space-per-level
  string prefixes: `<file>` at 2, `<comment>` at 4, comment children at 6. Replies sit at 6 and their
  children at 8.
- `xml-serializer.test.ts` mocks `xmllint-wasm`, so schema validation there is a no-op. Real
  validation lives in `xsd-schema.test.ts`. Put the "does it validate" assertions in the latter.
- Asset filenames are currently `${comment.id}-${index}.${ext}`. Replies need a distinct, collision-
  free scheme.

## Input Dependencies

- Task 1: `XSD_SCHEMA` and the emitted namespace are v3, and the schema accepts `<reply>`.
- Task 2: `ReviewComment.replies` and the `Reply` type exist.

## Output Artifacts

A serializer that emits complete, valid v3 threads with on-disk reply assets. Consumed by tasks 10
and 11 and by the plan's Self Validation steps.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

**1. Extract attachment emission.** Today `buildCommentXml` inlines this at lines ~644-648:

```ts
  if (comment.attachments?.length) {
    for (const att of comment.attachments) {
      lines.push(`      <attachment path="${escapeXml(att.fileName)}" media-type="${escapeXml(att.mediaType)}" />`);
    }
  }
```

Replace with a single helper both call sites use. AGENTS.md's no-duplication rule makes this
mandatory, not stylistic:

```ts
function buildAttachmentXml(attachments: Attachment[] | undefined, indent: string): string[] {
  if (!attachments?.length) return [];
  return attachments.map(
    att =>
      `${indent}<attachment path="${escapeXml(att.fileName)}" media-type="${escapeXml(att.mediaType)}" />`
  );
}
```

Import `Attachment` and `Reply` from `./types`.

**2. Add `buildReplyXml`:**

```ts
function buildReplyXml(reply: Reply): string[] {
  const attrStr = reply.author ? ` author="${escapeXml(reply.author)}"` : '';
  return [
    `      <reply${attrStr}>`,
    `        <body>${escapeXml(reply.body)}</body>`,
    ...buildAttachmentXml(reply.attachments, '        '),
    '      </reply>',
  ];
}
```

**3. Call it from `buildCommentXml`,** after the attachment lines and before the closing
`</comment>`. Order matters: the XSD sequence is body, category, suggestion, attachment, reply.

```ts
  lines.push(...buildAttachmentXml(comment.attachments, '      '));

  if (comment.replies?.length) {
    for (const reply of comment.replies) {
      lines.push(...buildReplyXml(reply));
    }
  }
```

**4. Extend `writeAttachments`.** This is the highest-risk edit in the task. The current function
maps over `file.comments` and rewrites `comment.attachments`, returning a new `ReviewState`. It must
now also rewrite `comment.replies[].attachments`. Extract the per-attachment write so both walks
share it:

```ts
function persistAttachments(
  attachments: Attachment[] | undefined,
  idPrefix: string,
  assetDir: string,
  onWrite: () => void
): Attachment[] | undefined {
  if (!attachments?.length) return attachments;

  return attachments.map((att, index) => {
    if (!att.data) return att;
    onWrite();

    const ext = extFromMediaType(att.mediaType);
    const fileName = `${idPrefix}-${index}.${ext}`;

    if (!fs.existsSync(assetDir)) {
      fs.mkdirSync(assetDir, { recursive: true });
    }
    fs.writeFileSync(path.join(assetDir, fileName), Buffer.from(att.data));

    return { ...att, fileName: `.self-review-assets/${fileName}`, data: undefined };
  });
}
```

Then the comment map becomes:

```ts
    comments: file.comments.map(comment => ({
      ...comment,
      attachments: persistAttachments(comment.attachments, comment.id, assetDir, markWritten),
      ...(comment.replies
        ? {
            replies: comment.replies.map(reply => ({
              ...reply,
              attachments: persistAttachments(
                reply.attachments,
                `${comment.id}-r-${reply.id}`,
                assetDir,
                markWritten
              ),
            })),
          }
        : {}),
    })),
```

where `markWritten = () => { hasAttachments = true; }`.

Two details that are easy to get wrong:

- The comment-attachment prefix stays exactly `comment.id` so existing asset filenames are unchanged.
  The reply prefix must not collide with it — `${comment.id}-r-${reply.id}` is unambiguous because a
  comment id never contains `-r-` followed by a reply id.
- The current code short-circuits with `if (!comment.attachments?.length) return comment;`. Remove
  that early return, or a comment with no attachments but with reply attachments silently skips the
  reply walk. **This is the bug the acceptance test above is designed to catch.**

**5. Tests.** Add to `packages/core/src/xml-serializer.test.ts` (which mocks `xmllint-wasm`, so
assert on the XML string and the filesystem, not validity). Use a real temp dir via
`fs.mkdtempSync(path.join(os.tmpdir(), 'sr-'))` and clean up in `afterEach`; follow whatever the file
already does for filesystem tests.

The reply-only-attachment test is the one that matters:

```ts
it('writes a reply attachment to disk even when its comment has none', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-reply-assets-'));
  const out = path.join(dir, 'review.xml');

  const xml = await serializeReview(
    {
      timestamp: '2024-01-15T10:30:00Z',
      source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
      files: [
        {
          path: 'src/main.ts',
          changeType: 'modified',
          viewed: true,
          comments: [
            {
              id: 'c1',
              filePath: 'src/main.ts',
              lineRange: null,
              body: 'no attachment here',
              category: 'bug',
              suggestion: null,
              replies: [
                {
                  id: 'r1',
                  body: 'screenshot attached',
                  attachments: [
                    { id: 'a1', fileName: 'shot.png', mediaType: 'image/png', data: new Uint8Array([1, 2, 3]).buffer },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    out
  );

  const written = fs.readdirSync(path.join(dir, '.self-review-assets'));
  expect(written).toHaveLength(1);
  expect(fs.statSync(path.join(dir, '.self-review-assets', written[0])).size).toBeGreaterThan(0);
  expect(xml).toContain(`<attachment path=".self-review-assets/${written[0])}"`.replace('}', ''));
});
```

(Fix the last assertion's string interpolation to whatever reads cleanly — the point is that the
emitted `path` attribute names the file that exists on disk.)

Add the three-reply validation test to `packages/core/src/xsd-schema.test.ts`, where the real
validator runs:

```ts
it('emits a valid v3 document carrying a three-reply thread', async () => {
  const xml = await serializeReview(stateWithThreeReplies, '/tmp/test-review-replies.xml');

  expect((await validate(xml)).valid).toBe(true);
  const order = [...xml.matchAll(/<body>(reply [123])<\/body>/g)].map(m => m[1]);
  expect(order).toEqual(['reply 1', 'reply 2', 'reply 3']);
  expect(xml).toContain('<reply author="Claude Opus 5">');
});
```

And the escaping test:

```ts
it('escapes markup in a reply body', async () => {
  // body: '```ts\nif (a < b && c > d) {}\n```'
  expect(xml).toContain('a &lt; b &amp;&amp; c &gt; d');
});
```

**Do not** add per-reply severity, category, suggestion or nesting. Those are enumerated non-goals in
the plan's Success Criteria; their presence in the diff is a plan violation.

**Verification:**

```bash
npm run test:unit && npm run lint
```

</details>
