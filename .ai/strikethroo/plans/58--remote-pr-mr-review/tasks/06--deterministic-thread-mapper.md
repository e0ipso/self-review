---
id: 6
group: "forge-core"
dependencies: [1, 2]
status: "pending"
created: 2026-08-04
skills:
  - typescript
  - vitest
complexity_score: 5
---
# Deterministic thread-to-ReviewState mapper

## Objective
Implement the pure, fully deterministic mapper in `@self-review/core` that converts
normalized forge threads into v3 `ReviewComment` threads: root + ordered replies, forge
usernames as `author`, forge IDs as `remoteId`, line anchors mapped onto the
exactly-one-pair rule, and outdated anchors degraded to file-level comments. No LLM, no
heuristics, fetch direction only.

## Skills Required
TypeScript pure-function design; Vitest fixture-based testing.

## Acceptance Criteria
- [ ] `packages/core/src/thread-mapper.ts` exports a pure function mapping
      `ForgeThread[]` → `ReviewComment[]` (with replies), with no I/O, no randomness, no
      timestamps — same input always yields identical output.
- [ ] Anchor mapping honors the exactly-one-pair rule: new-side anchors set
      `newLineStart`/`newLineEnd` only; old-side anchors set `oldLineStart`/`oldLineEnd`
      only; single-line anchors set start = end; a comment never carries both pairs.
- [ ] Threads flagged `outdated` (and threads with no line anchor but a file path) map to
      file-level comments (neither pair set); threads with no file path at all map to a
      documented review-level representation consistent with the existing model.
- [ ] Root turn becomes the root comment (owning the anchor); subsequent turns become
      ordered flat replies in document order; forge usernames land in `author`; forge
      thread/comment IDs land in `remoteId` on root and replies respectively.
- [ ] Mapped comments carry no category, severity, or confidence (forge threads have
      none; absent means below every threshold).
- [ ] Fixture-based unit tests cover, for both forges' normalized shapes: added-line,
      deleted-line (old side), context-line, multi-line range, outdated → file-level,
      positionless thread, reply chain order, author and remote-id propagation, and a
      determinism check (map twice, deep-equal).
- [ ] Verification: `npx vitest run packages/core/src/thread-mapper.test.ts` passes;
      `npm run test:unit` stays green.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Input is the forge-neutral thread shape from task 2 — the mapper must contain no
  forge-conditional logic; anything forge-specific belongs in the providers.
- Output uses the `ReviewComment`/reply types as extended in task 1 (`remoteId`,
  `author` optional fields).
- Comment IDs for the app's own bookkeeping follow whatever the existing model requires
  (inspect `ReviewComment` in `packages/types/src/index.ts`); if the app generates its
  own internal IDs, generate them deterministically from the forge IDs.

## Input Dependencies
- Task 1: extended `ReviewComment`/reply types with `remoteId`.
- Task 2: normalized `ForgeThread` types.

## Output Artifacts
- `packages/core/src/thread-mapper.ts` (+ test), exported from the core index. Consumed
  by tasks 7 and 8.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

Test philosophy (apply as written): "write a few tests, mostly integration" — meaningful
tests verify custom business logic, critical paths, and edge cases specific to this
application. Test *your* code, not the framework. This mapper IS core custom business
logic with many edge cases, so thorough fixture coverage is justified here; combine
related scenarios into grouped tests rather than one test per trivial permutation, and do
not test the type system or JSON plumbing.

1. Body mapping: forge markdown bodies pass through verbatim (the comment body is
   markdown in the existing model).
2. The v3 rule "comments on added/context lines use newLine*, deleted lines use oldLine*"
   maps directly from the neutral `side`: `'new'` → new pair, `'old'` → old pair. The
   neutral shape never distinguishes added vs context — both are new-side, which is
   exactly what the rule needs.
3. File-level degradation: `outdated: true` → drop the line anchor, keep `filePath`.
   Prepend nothing to the body — the degradation is structural, not textual.
4. Review-level (no file path): check how the existing model represents review-level
   comments (see `ReviewState` / XSD); if the model only supports file-level and line
   anchors, attach to no file only if the schema allows it — otherwise document the
   chosen fallback in code and map to the closest legal shape. Align with what the
   serializer accepts; never emit an unserializable comment.
5. Keep the function synchronous and dependency-free so skills/CI reuse it unchanged.
</details>
