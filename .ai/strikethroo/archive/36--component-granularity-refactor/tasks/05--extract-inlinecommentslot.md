---
id: 5
group: "diffview-dedup"
dependencies: []
status: "completed"
created: "2026-03-11"
skills: ["react-components", "typescript"]
---
# Extract `InlineCommentSlot` Shared by `SplitView` and `UnifiedView`

## Objective
Eliminate the duplicated inline comment rendering pattern that appears identically in both `SplitView.tsx` and `UnifiedView.tsx` by extracting it into a shared `InlineCommentSlot` component.

## Skills Required
- react-components
- typescript

## Acceptance Criteria
- [ ] `InlineCommentSlot.tsx` exists in `packages/react/src/components/DiffViewer/`
- [ ] `SplitView.tsx` and `UnifiedView.tsx` each import and use `InlineCommentSlot` with zero duplicated comment-slot JSX remaining in either file
- [ ] `InlineCommentSlot` accepts `commentsToRender`, `showCommentInput`, `commentRange`, `filePath`, `originalCode`, `onCancel`, `onSaved`, and an optional offset/indent prop (used by unified view's `ml-[100px]` offset)
- [ ] Behaviour is visually identical before and after for both view modes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:e2e` passes

## Technical Requirements
- Source files: `packages/react/src/components/DiffViewer/SplitView.tsx` and `UnifiedView.tsx`
- New file: `packages/react/src/components/DiffViewer/InlineCommentSlot.tsx`
- The `ml-[100px]` offset specific to unified view is passed as a prop (e.g., `indent?: string` or a boolean `unifiedOffset`)
- Both views render the same pattern: `CommentDisplay` items for lines whose range ends here, then a `CommentInput` when the active comment range ends at this line

## Input Dependencies
None

## Output Artifacts
- `packages/react/src/components/DiffViewer/InlineCommentSlot.tsx` — new shared component
- Updated `packages/react/src/components/DiffViewer/SplitView.tsx`
- Updated `packages/react/src/components/DiffViewer/UnifiedView.tsx`

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

1. **Read `SplitView.tsx` and `UnifiedView.tsx`** side-by-side and identify the identical comment-slot JSX pattern in each. It appears after each diff line row and consists of:
   - A list of `<CommentDisplay>` elements for comments whose `newLineEnd` (or `oldLineEnd`) equals the current line key
   - A conditional `<CommentInput>` rendered when `commentRange.endLine === currentLineKey`

2. **Create `InlineCommentSlot.tsx`** extracting the common JSX. Define a clear prop interface:
   ```ts
   interface InlineCommentSlotProps {
     commentsToRender: ReviewComment[];
     showCommentInput: boolean;
     commentRange: CommentRange | null;
     filePath: string;
     originalCode: string;
     onCancel: () => void;
     onSaved: () => void;
     indentClass?: string; // e.g. "ml-[100px]" for unified view
   }
   ```

3. **Replace** the duplicated JSX in both `SplitView.tsx` and `UnifiedView.tsx` with `<InlineCommentSlot ... />`. Pass `indentClass="ml-[100px]"` in the `UnifiedView` call site.

4. **Run `npm run test:unit && npm run test:e2e`** and confirm no failures.

5. **Verify**: `grep -n "CommentDisplay\|CommentInput" packages/react/src/components/DiffViewer/SplitView.tsx` should show only the import lines, not rendering code. Same for `UnifiedView.tsx`.

</details>
