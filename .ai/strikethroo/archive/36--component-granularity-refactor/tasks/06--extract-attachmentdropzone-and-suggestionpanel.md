---
id: 6
group: "commentinput-refactor"
dependencies: []
status: "completed"
created: "2026-03-11"
skills: ["react-components", "typescript"]
---
# Extract `AttachmentDropZone` and `SuggestionPanel` from `CommentInput`

## Objective
Isolate the two largest non-editor sub-concerns within `CommentInput.tsx` (370 lines) into separately renderable components: `AttachmentDropZone` (drag-and-drop + paste attachment handling) and `SuggestionPanel` (the original/proposed code textareas).

## Skills Required
- react-components
- typescript

## Acceptance Criteria
- [ ] `AttachmentDropZone.tsx` exists in `packages/react/src/components/Comments/` and wraps children with drag-enter, drag-leave, drag-over, drop, and paste handlers; maintains `isDragging` state and renders the drop overlay
- [ ] `SuggestionPanel.tsx` exists in `packages/react/src/components/Comments/` and renders the two labelled textareas (original disabled, proposed editable)
- [ ] `CommentInput.tsx` is reduced to ~100 lines, composing `AttachmentDropZone`, `SuggestionPanel`, and the MDEditor + action bar
- [ ] Attachment drag-and-drop, paste, and suggestion editing behaviour is visually and functionally identical before and after
- [ ] `npm run test:unit` passes
- [ ] `npm run test:e2e` passes

## Technical Requirements
- Source file: `packages/react/src/components/Comments/CommentInput.tsx`
- New files:
  - `packages/react/src/components/Comments/AttachmentDropZone.tsx`
  - `packages/react/src/components/Comments/SuggestionPanel.tsx`
- `AttachmentDropZone` uses a children-wrapping pattern (render prop or children prop) so `CommentInput` passes its editor and action bar as children
- `SuggestionPanel` props: `originalCode: string`, `proposedCode: string`, `onProposedChange: (code: string) => void`

## Input Dependencies
None

## Output Artifacts
- `packages/react/src/components/Comments/AttachmentDropZone.tsx`
- `packages/react/src/components/Comments/SuggestionPanel.tsx`
- Updated `packages/react/src/components/Comments/CommentInput.tsx`

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

1. **Read `CommentInput.tsx`** in full. Identify:
   - The drag-enter, drag-leave, drag-over, drop, and paste event handlers (~80 lines)
   - The `isDragging` state and the drop-overlay rendering
   - The suggestion textareas block (original read-only textarea, proposed editable textarea with separator) (~35 lines)

2. **Create `AttachmentDropZone.tsx`**:
   ```tsx
   interface AttachmentDropZoneProps {
     onAttach: (files: File[]) => void; // or whatever callback the handlers call
     children: React.ReactNode;
   }
   ```
   - Internal state: `isDragging`
   - Renders a wrapper `<div>` with all drag/paste event handlers and a drop-overlay when `isDragging` is true
   - Calls `onAttach` when files are dropped or pasted

3. **Create `SuggestionPanel.tsx`**:
   ```tsx
   interface SuggestionPanelProps {
     originalCode: string;
     proposedCode: string;
     onProposedChange: (code: string) => void;
   }
   ```
   - Renders the "Original" label + disabled textarea, separator, "Proposed" label + editable textarea
   - Uses shadcn `<Textarea>` components (keep as plain shadcn, not MDEditor)

4. **Update `CommentInput.tsx`**:
   - Wrap the MDEditor and action bar with `<AttachmentDropZone onAttach={handleAttach}>...</AttachmentDropZone>`
   - Replace the suggestion block with `{showSuggestion && <SuggestionPanel ... />}`
   - Remove all extracted code (~115 lines total)

5. **Run `npm run test:unit && npm run test:e2e`** and confirm no failures.

6. **Size check**: `CommentInput.tsx` should be ~100 lines or fewer.

</details>
