---
id: 7
group: "review-ui"
dependencies: [6]
status: "completed"
created: 2026-07-31
skills:
  - react-components
  - typescript
complexity_score: 5
execution_profile: "standard-implementation"
---
# Render threads in `CommentDisplay`

## Objective

Render a comment's replies beneath it with the same author attribution comments use, offer a Reply
action on every comment regardless of author, and allow ungated edit and delete on each reply.

## Skills Required

React component composition and Tailwind layout within a constrained diff gutter.

## Acceptance Criteria

- [ ] `CommentDisplay` renders `comment.replies` beneath the comment body (after the suggestion and
      attachment blocks), visually indented, in array order.
- [ ] Each reply shows a `Bot` icon plus the author name when `reply.author` is set, and a `User`
      icon plus "You" when it is not — matching the existing comment header logic at
      `CommentDisplay.tsx:167-179`.
- [ ] A Reply action appears on **every** comment, authored or not, and on comments created in the
      current session. It is not conditioned on `comment.author`.
- [ ] Clicking Reply mounts `ReplyInput` at the bottom of the thread; submitting appends the reply and
      closes the composer; Cancel closes it without adding.
- [ ] Each reply carries Edit and Delete controls with no author gating, mirroring root comments
      (which are ungated today at `CommentDisplay.tsx:118`). Edit swaps the reply for a prefilled
      `ReplyInput`; Delete calls `deleteReply(comment.id, reply.id)`.
- [ ] Reply bodies render through `ReactMarkdown` with `[remarkGfm, remarkEmoji]`, the same plugin
      set the comment body uses, so fenced code blocks and `:shortcode:` emoji work in replies.
- [ ] Reply attachments render via `AttachmentImage`, as comment attachments do.
- [ ] Stable test hooks exist: `data-testid={\`reply-${reply.id}\`}` on each reply,
      `data-testid={\`reply-btn-${comment.id}\`}` on the Reply action.
- [ ] Collapsing the comment (the existing chevron toggle and the global `toggle-all-comments` event)
      hides the replies too — they are part of the comment's body region, not siblings of it.
- [ ] A three-reply thread does not overflow or break the diff layout in either split or unified
      view. Verify by inspection of the rendered widths/wrapping rules; the screenshot proof belongs
      to the plan's Self Validation.
- [ ] `npm run test:unit` passes, `npm run lint` exits 0, and `npx bddgen` succeeds.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `packages/react/src/components/Comments/CommentDisplay.tsx`, plus a small `ReplyDisplay`
  sub-component (same file or its own — prefer its own file if `CommentDisplay` grows past ~360
  lines).
- shadcn/ui components only (`Button`, `Badge`, `Tooltip` are already imported).
- The long prose-styling class string on the comment body div (`CommentDisplay.tsx:269`) is needed
  identically for reply bodies. Per AGENTS.md's no-duplication rule, hoist it to a module-level
  constant used by both rather than copy-pasting it.
- Replies must **not** get category, severity or confidence badges. Those belong to the root comment
  and adding them is an explicit non-goal.

## Input Dependencies

- Task 6: `ReplyInput`.
- Task 5 (transitively): `addReply`, `updateReply`, `deleteReply` on the review context.

## Output Artifacts

The complete UI thread affordance. Consumed by tasks 10 and 11 and by the plan's Self Validation.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

**1. Hoist the prose class string.** At module level in `CommentDisplay.tsx`:

```tsx
const PROSE_CLASSES =
  '[&_p]:my-1 [&_ul]:my-1 ... [&_pre_code]:bg-transparent [&_pre_code]:p-0';
```

Copy it verbatim from the existing body div, then use
`className={\`px-3 pb-3 text-sm text-foreground leading-relaxed ${PROSE_CLASSES}\`}` for the comment
and the same constant for reply bodies. Do not reformat or "tidy" the class list while moving it —
an accidental class drop silently degrades rendering.

**2. Add `ReplyDisplay`:**

```tsx
function ReplyDisplay({ commentId, reply }: { commentId: string; reply: Reply }) {
  const { deleteReply } = useReview();
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <ReplyInput
        commentId={commentId}
        existingReply={reply}
        onCancel={() => setIsEditing(false)}
        onSubmit={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className='group/reply border-t border-border/50 pt-2' data-testid={`reply-${reply.id}`}>
      <div className='flex items-center justify-between px-3'>
        <span className='flex items-center gap-1 text-xs font-semibold text-foreground max-w-[200px] truncate'>
          {reply.author ? (<><Bot className='h-3.5 w-3.5 shrink-0' />{reply.author}</>)
                        : (<><User className='h-3.5 w-3.5 shrink-0' />You</>)}
        </span>
        <div className='flex gap-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity'>
          {/* Pencil → setIsEditing(true); Trash2 → deleteReply(commentId, reply.id) */}
        </div>
      </div>
      <div className={`px-3 pb-2 text-sm ${PROSE_CLASSES}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji]}>{reply.body}</ReactMarkdown>
      </div>
      {reply.attachments?.length ? (
        <div className='flex gap-2 flex-wrap px-3 pb-2'>
          {reply.attachments.map(att => <AttachmentImage key={att.id} attachment={att} />)}
        </div>
      ) : null}
    </div>
  );
}
```

Use a **named** group (`group/reply` + `group-hover/reply:`) rather than the bare `group` the comment
container already uses, or hovering anywhere on the comment reveals every reply's controls at once.

**3. Mount the thread in `CommentDisplay`.** Inside the existing `{!isCollapsed && (<>...</>)}`
fragment, after the attachments block:

```tsx
{comment.replies?.length ? (
  <div className='ml-4 border-l-2 border-border/60' data-testid={`thread-${comment.id}`}>
    {comment.replies.map(reply => (
      <ReplyDisplay key={reply.id} commentId={comment.id} reply={reply} />
    ))}
  </div>
) : null}

{isReplying ? (
  <div className='ml-4 px-3 pb-3'>
    <ReplyInput
      commentId={comment.id}
      onCancel={() => setIsReplying(false)}
      onSubmit={() => setIsReplying(false)}
    />
  </div>
) : (
  <div className='px-3 pb-3'>
    <Button
      variant='ghost'
      size='sm'
      onClick={() => setIsReplying(true)}
      data-testid={`reply-btn-${comment.id}`}
      className='h-7 gap-1.5 text-xs text-muted-foreground'
    >
      <Reply className='h-3.5 w-3.5' />
      Reply
    </Button>
  </div>
)}
```

`Reply` is a `lucide-react` icon; import it under an alias (`Reply as ReplyIcon`) to avoid colliding
with the `Reply` **type** imported from `@self-review/types` in the same file.

Add `const [isReplying, setIsReplying] = useState(false);` alongside the existing `isEditing` and
`isCollapsed` state.

Placing both blocks inside the `!isCollapsed` fragment is what satisfies the collapse criterion — no
extra wiring needed.

**4. Layout check.** The indent is `ml-4` + a left border, so a thread inside a split-view gutter
loses 16px per level — and there is only ever one level, because replies are flat. Confirm the reply
body's `overflow-x-auto` on `<pre>` (inherited from `PROSE_CLASSES`) keeps a long fenced block from
widening the container.

**5. Non-goals.** Do not add: a resolved/unresolved toggle, per-reply category or severity badges, a
suggestion affordance in the reply composer, nested reply-to-reply threading, or reply timestamps.
Each is explicitly ruled out in the plan's Success Criteria and will be checked for in the diff.

**Verification:**

```bash
npm run test:unit && npm run lint && npx bddgen
```

</details>
