---
id: 5
group: "review-ui"
dependencies: [2]
status: "pending"
created: 2026-07-31
skills:
  - react
  - typescript
complexity_score: 4
execution_profile: "standard-implementation"
---
# Add reply operations to review state

## Objective

Add `addReply`, `updateReply` and `deleteReply` to `useReviewState`, expose all three through
`ReviewContext`, and re-export the `Reply` type from `@self-review/react` so consumers can type
against it.

## Skills Required

React state management (immutable nested updates in `useState` setters) and TypeScript.

## Acceptance Criteria

- [ ] `useReviewState` returns `addReply`, `updateReply` and `deleteReply`, all three declared in
      `UseReviewStateReturn`.
- [ ] `addReply(commentId, body, author?, attachments?)` **appends** to the target comment's
      `replies`, creating the array when absent. Appending, never prepending: array order is
      conversation order.
- [ ] `updateReply(commentId, replyId, updates)` and `deleteReply(commentId, replyId)` locate the
      reply by comment id **plus** reply id, and leave every other comment and reply untouched.
- [ ] All three are on `ReviewContextValue` and wired in the provider's `value={{...}}`.
- [ ] `Reply` is re-exported from `packages/react/src/index.ts` alongside the other
      `@self-review/types` re-exports.
- [ ] `Reply` is added to the explicit named export list in `src/shared/types.ts`. That file is
      **not** a wildcard re-export — it names each type individually, so `Reply` is unreachable from
      the Electron main and renderer processes until it is listed. Verified by
      `grep -n "Reply" src/shared/types.ts` returning a hit inside the `export type { ... }` block.
- [ ] A unit test file for the hook covers: append order across two successive `addReply` calls on
      the same comment; `updateReply` changing one reply's body while its siblings and the comment
      body are unchanged; `deleteReply` removing exactly one reply; and `addReply` on a comment whose
      `replies` is `undefined` producing a one-element array.
- [ ] `npm run test:unit` passes in full and `npm run lint` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `packages/react/src/hooks/useReviewState.ts`,
  `packages/react/src/context/ReviewContext.tsx`, `packages/react/src/index.ts` and
  `src/shared/types.ts`.
- `src/shared/types.ts` re-exports from `packages/types/src/index` by explicit name. Task 2
  confirmed it lists `ReviewComment` and `Attachment` but has no `Reply` entry. Add it. Nothing
  breaks without it today — `ReviewComment.replies` flows through structurally — but the moment any
  `src/` code needs to name the type it cannot import it.
- Follow the existing shape: `setFiles(prevFiles => prevFiles.map(...))`, no mutation, ids from
  `crypto.randomUUID()` as `addComment` already does.
- Renderer tests run under jsdom. Check whether `packages/react` has an existing hook test to model
  on; if none exists, place the new test next to the hook as `useReviewState.test.ts` and confirm it
  is picked up by the vitest config that runs for `npm run test:unit`. If it is not picked up, say so
  rather than silently leaving an unexecuted test file.

## Input Dependencies

Task 2: the `Reply` type and `ReviewComment.replies`.

## Output Artifacts

`addReply` / `updateReply` / `deleteReply` on the review context — consumed by tasks 6 and 7.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

**1. `useReviewState.ts`.** Import `Reply` from `@self-review/types` and add to
`UseReviewStateReturn`:

```ts
  addReply: (
    commentId: string,
    body: string,
    author?: string,
    attachments?: Attachment[]
  ) => void;
  updateReply: (commentId: string, replyId: string, updates: Partial<Reply>) => void;
  deleteReply: (commentId: string, replyId: string) => void;
```

Implementations, mirroring the existing comment operations:

```ts
  const addReply = (
    commentId: string,
    body: string,
    author?: string,
    attachments?: Attachment[]
  ) => {
    const newReply: Reply = {
      id: crypto.randomUUID(),
      body,
      ...(author ? { author } : {}),
      ...(attachments?.length ? { attachments } : {}),
    };

    setFiles(prevFiles =>
      prevFiles.map(file => ({
        ...file,
        comments: file.comments.map(comment =>
          comment.id === commentId
            ? { ...comment, replies: [...(comment.replies ?? []), newReply] }
            : comment
        ),
      }))
    );
  };

  const updateReply = (commentId: string, replyId: string, updates: Partial<Reply>) => {
    setFiles(prevFiles =>
      prevFiles.map(file => ({
        ...file,
        comments: file.comments.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                replies: comment.replies?.map(reply =>
                  reply.id === replyId ? { ...reply, ...updates } : reply
                ),
              }
            : comment
        ),
      }))
    );
  };

  const deleteReply = (commentId: string, replyId: string) => {
    setFiles(prevFiles =>
      prevFiles.map(file => ({
        ...file,
        comments: file.comments.map(comment =>
          comment.id === commentId
            ? { ...comment, replies: comment.replies?.filter(reply => reply.id !== replyId) }
            : comment
        ),
      }))
    );
  };
```

Add all three to the returned object.

Note `deleteReply` leaves an empty array behind when the last reply goes. That is fine: the
serializer emits nothing for an empty array, and the type allows it. Do not add cleanup logic that
converts `[]` back to `undefined` — it buys nothing and is one more branch to get wrong.

**2. `ReviewContext.tsx`.** Add the same three signatures to `ReviewContextValue`, import `Reply`,
and wire them in the provider value:

```ts
        addReply: reviewState.addReply,
        updateReply: reviewState.updateReply,
        deleteReply: reviewState.deleteReply,
```

**3. `packages/react/src/index.ts`.** Add `Reply` to the `export type { ... } from
'@self-review/types'` block.

**4. Tests.** Use `renderHook` + `act` from `@testing-library/react` if the package already depends on
it; otherwise test the reducer logic directly. Check `packages/react/package.json` and the repo's
vitest configs before choosing.

The order test is the one with teeth:

```ts
act(() => { result.current.addReply('c1', 'first'); });
act(() => { result.current.addReply('c1', 'second'); });
expect(result.current.files[0].comments[0].replies.map(r => r.body)).toEqual(['first', 'second']);
```

**Verification:**

```bash
npm run test:unit && npm run lint
```

</details>
