---
id: 2
group: "schema-contract"
dependencies: []
status: "completed"
created: 2026-07-31
skills:
  - typescript
complexity_score: 2
execution_profile: "standard-implementation"
---
# Add `Reply` to the shared type contract

## Objective

Add a `Reply` interface and an optional `ReviewComment.replies` field to `@self-review/types`, the
single contract that core, react, the Electron main process and the renderer all import from.

## Skills Required

TypeScript interface authoring.

## Acceptance Criteria

- [ ] `packages/types/src/index.ts` exports a `Reply` interface with `id: string`, `body: string`,
      `author?: string`, `attachments?: Attachment[]` — and nothing else.
- [ ] `ReviewComment` gains `replies?: Reply[]`.
- [ ] `Reply.id` carries a doc comment stating it is an in-memory render key that is **not
      persisted**, mirroring `ReviewComment.id`.
- [ ] The two doc comments at `packages/types/src/index.ts:68` and `:74` that reference
      `self-review-v2.xsd` now reference `self-review-v3.xsd`.
- [ ] `npx tsc --noEmit -p packages/types` (or the package's existing typecheck/build script)
      exits 0.
- [ ] `npm run test:unit` passes and `npm run lint` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `packages/types` has zero runtime dependencies. Add types only — no functions, no constants.
- `src/shared/types.ts` in the Electron app re-exports from this package, so no change is needed
  there. Confirm that is still true rather than assuming it.

## Input Dependencies

None.

## Output Artifacts

`Reply` and `ReviewComment.replies` — consumed by tasks 3, 4, 5, 6 and 7.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

Insert directly above `export interface ReviewComment` in `packages/types/src/index.ts`:

```ts
/**
 * One turn in the conversation about a comment.
 *
 * A reply is deliberately thin. It carries no category, no severity, no
 * confidence and no suggestion: all four are properties of the finding, and
 * the finding is the root comment. A counter-proposal goes in `body` as a
 * fenced code block.
 *
 * Ordering is positional. The array order is the document order is the
 * conversation order, in all three directions. Nothing sorts replies.
 */
export interface Reply {
  /**
   * In-memory render key only. Like `ReviewComment.id`, this is regenerated
   * on every parse and is never written to XML — the tree supplies parent
   * linkage and document order supplies ordering, so nothing needs naming.
   */
  id: string;
  body: string;
  /** Absent means the human reviewer, present means a bot or LLM. */
  author?: string;
  attachments?: Attachment[];
}
```

Then add to `ReviewComment`, after `attachments`:

```ts
  /** Ordered conversation turns on this comment. Undefined when there are none. */
  replies?: Reply[];
```

Note the deliberate asymmetry with `attachments`: absent, not empty array, when there are none. The
parser mirrors this.

Finally fix the two stale schema references in the `CommentSeverity` and `CommentConfidence` doc
comments (`self-review-v2.xsd` → `self-review-v3.xsd`).

Do not touch `packages/core`, `packages/react`, or `src/` in this task.

**Verification:**

```bash
npm run test:unit && npm run lint
```

</details>
