---
id: 6
group: "review-ui"
dependencies: [5]
status: "pending"
created: 2026-07-31
skills:
  - react-components
  - typescript
complexity_score: 6
complexity_notes: "An extraction refactor of a 300-line component that must not change existing comment-editor behaviour, done under an explicit AGENTS.md mandate that forbids the cheaper variant-prop shortcut."
execution_profile: "complex-architecture"
---
# Extract the composer core and add `ReplyInput`

## Objective

Extract the MDEditor body, emoji autocomplete and attachment handling out of `CommentInput` into a
shared component, rebuild `CommentInput` on top of it with no behaviour change, and add a thinner
`ReplyInput` that consumes the same core without the category selector or suggestion panel.

## Skills Required

React component extraction and composition; TypeScript prop typing.

## Acceptance Criteria

- [ ] A new shared component (suggested: `packages/react/src/components/Comments/ComposerCore.tsx`)
      owns the `AttachmentDropZone` + `MDEditor` + `EmojiAutocomplete` + attachment thumbnail strip +
      file-picker, and is imported by both `CommentInput` and `ReplyInput`.
- [ ] `CommentInput` contains **no** `MDEditor`, `EmojiAutocomplete` or `useEmojiAutocomplete` usage
      of its own. `grep -c "MDEditor" packages/react/src/components/Comments/CommentInput.tsx`
      returns 0.
- [ ] `ReplyInput` renders no `CategorySelector` and no `SuggestionPanel`, and offers no "Suggest"
      button. `grep -E "CategorySelector|SuggestionPanel|add-suggestion-btn"
      packages/react/src/components/Comments/ReplyInput.tsx` finds nothing.
- [ ] `CommentInput` is **not** given a `variant`, `mode`, `isReply` or equivalent prop that hides
      part of its UI. Reviewers will check for this specifically.
- [ ] `ReplyInput` calls `addReply` when creating and `updateReply` when given an `existingReply`,
      supports Ctrl/Cmd+Enter to submit and Escape to unfocus like `CommentInput` does, and carries
      `data-testid='reply-input'`, `data-testid='add-reply-btn'` and `data-testid='cancel-reply-btn'`.
- [ ] Existing webapp e2e commenting behaviour is unchanged: the comment input still exposes
      `data-testid='comment-input'`, `data-testid='comment-actions'`, `data-testid='add-comment-btn'`,
      `data-testid='cancel-comment-btn'` and `data-testid='add-suggestion-btn'`, and the
      line-range extra command still renders "Comment on line N".
- [ ] `npx bddgen` succeeds and `npm run test:unit` passes in full; `npm run lint` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files: `packages/react/src/components/Comments/CommentInput.tsx` (refactor), new
  `ComposerCore.tsx`, new `ReplyInput.tsx`.
- AGENTS.md **Extract before extending** is binding here. The plan calls this out as the single place
  where the shortcut is most tempting and explicitly rules it out: a `variant="reply"` prop on
  `CommentInput` that conditionally hides the category selector and suggestion panel is a plan
  violation, not a simplification.
- shadcn/ui components only. No raw `<button>`/`<input>` for UI affordances (the hidden
  `<input type='file'>` inside the core is the existing exception and stays as-is).
- The e2e suites cannot run in the dev container. `npx bddgen` is the in-container proxy for "the
  feature files still bind"; it does not prove the UI works.

## Input Dependencies

Task 5: `addReply` and `updateReply` on `ReviewContext`.

## Output Artifacts

`ComposerCore` and `ReplyInput` — consumed by task 7 (`CommentDisplay` mounts `ReplyInput`).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

**1. Define the core's contract.** `ComposerCore` is a controlled component. It owns no submit
semantics — the parent decides what "submit" means:

```tsx
export interface ComposerCoreProps {
  body: string;
  onBodyChange: (body: string) => void;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  placeholder?: string;
  /** Rendered as an MDEditor extraCommand, e.g. the "Comment on line 5" label. */
  headerLabel?: React.ReactNode;
  onSubmit: () => void;
  /** data-testid of the wrapping element, so Escape can focus the actions bar. */
  testId: string;
  height?: number;
}
```

Move into it, verbatim from `CommentInput`:

- `editorContainerRef`, `isDragging` state, `fileInputRef`
- the `useEmojiAutocomplete(body, setBody, editorContainerRef)` call
- the auto-focus `useEffect` that focuses `.w-md-editor-text-input` on mount
- `resolveIsDark()` and the `data-color-mode` wrapper
- the `<AttachmentDropZone>` + `<MDEditor>` + `<EmojiAutocomplete>` block
- the attachment thumbnail strip and its "N image(s)" label
- the hidden file input and the `Attach` button

The Escape handler currently does
`(e.target).closest('[data-testid="comment-input"]')?.querySelector('[data-testid="comment-actions"]')`.
Parameterize the outer selector via `testId` so `ReplyInput` gets the same behaviour; keep the inner
actions selector convention (`${testId}` wrapper containing a `-actions` testid) consistent between
the two.

Expose the Attach button so the parent can place it in its own actions bar, **or** keep the actions
bar inside the core with a `slot` for parent-specific controls. Pick one and be consistent; the
former is simpler. If the Attach button moves to the parent, the file input and its `onChange` go
with it — do not split them across components.

**2. Rebuild `CommentInput` on the core.** It keeps: `filePath`/`lineRange`/`existingComment`/
`originalCode` props, `category` state, `showSuggestion`/`proposedCode` state, `handleSubmit`,
`handleCancel`, `hasContent`/`isValid`, the `CategorySelector`, the `Suggest` toggle, the
`SuggestionPanel`, and the Cancel/Comment buttons. Everything else comes from `ComposerCore`.

Behaviour must be byte-for-byte equivalent from the user's side. The webapp e2e suite in
`tests/webapp-features/03-commenting.feature` and `04-suggestions.feature` is the contract; read both
before you start and check every `data-testid` and visible string they rely on survives.

**3. Write `ReplyInput`:**

```tsx
export interface ReplyInputProps {
  commentId: string;
  existingReply?: Reply;
  onCancel: () => void;
  onSubmit?: () => void;
}
```

State: `body`, `attachments`. Prefill both from `existingReply` in a `useEffect`, matching how
`CommentInput` prefills from `existingComment`.

```tsx
const handleSubmit = () => {
  if (!body.trim() && attachments.length === 0) return;

  if (existingReply) {
    updateReply(commentId, existingReply.id, {
      body,
      ...(attachments.length ? { attachments } : {}),
    });
  } else {
    addReply(commentId, body, undefined, attachments.length ? attachments : undefined);
  }

  setBody('');
  setAttachments([]);
  onSubmit?.();
};
```

`author` is left `undefined`: a reply composed in the UI is the human's. The `author` attribute is
only ever set by an LLM writing XML directly.

The actions bar has Attach, Cancel and a primary button reading `Reply` (or `Update` when editing).
No category, no suggestion.

Placeholder: `'Reply to this comment... (paste or drop images here)'`. Consider a shorter editor
(`height={160}`) since replies are typically shorter than findings — but keep it a constant, not a
prop the caller has to think about.

**4. Do not** export `ComposerCore` from `packages/react/src/index.ts`. It is an internal composition
detail; exporting it makes it public API you then have to keep stable.

**Verification:**

```bash
npm run test:unit && npm run lint && npx bddgen
```

Note that `npx bddgen` only regenerates specs from feature files — it proves step bindings resolve,
not that the UI behaves. The real check happens in tasks 10 and 11 and in the plan's Self Validation.

</details>
