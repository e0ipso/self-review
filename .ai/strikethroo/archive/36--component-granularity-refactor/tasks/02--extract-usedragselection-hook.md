---
id: 2
group: "filesection-refactor"
dependencies: []
status: "completed"
created: "2026-03-11"
skills: ["react-components", "typescript"]
---
# Extract `useDragSelection` Hook from `FileSection`

## Objective
Extract the ~130-line imperative drag-tracking block from `FileSection.tsx` into a self-contained `useDragSelection` hook that encapsulates all drag state, document-level event listeners, and the `trigger-line-comment` custom-event listener.

## Skills Required
- react-components
- typescript

## Acceptance Criteria
- [ ] `useDragSelection.ts` exists in `packages/react/src/components/DiffViewer/`
- [ ] Hook accepts `sectionRef`, `effectiveViewMode`, and hunk line-map data structures as inputs
- [ ] Hook returns `dragState`, `handleDragStart`, and `handleCommentRange` callback
- [ ] All `mousemove`/`mouseup` document-level listeners and the `trigger-line-comment` custom-event listener are inside the hook's effect
- [ ] `FileSection.tsx` is materially smaller; all drag-related state and handlers replaced by a single hook call
- [ ] `npm run test:unit` passes

## Technical Requirements
- Source file: `packages/react/src/components/DiffViewer/FileSection.tsx`
- New file: `packages/react/src/components/DiffViewer/useDragSelection.ts`
- The hook must not introduce stale closures; use `useRef` for mutable stable values (following the existing `dragStateRef` pattern already in `FileSection`)
- The `trigger-line-comment` custom event listener (for keyboard hint triggering) belongs inside this hook since it is part of the same "how does a comment range get initiated" concern

## Input Dependencies
None

## Output Artifacts
- `packages/react/src/components/DiffViewer/useDragSelection.ts` — new hook
- Updated `packages/react/src/components/DiffViewer/FileSection.tsx` — uses the hook

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

1. **Read `FileSection.tsx`** in full to understand the drag-selection block:
   - Look for `dragStateRef`, `dragState`, `handleDragStart` and related handlers
   - Find the `useEffect` that registers `mousemove`, `mouseup` document listeners
   - Find the `trigger-line-comment` custom event listener
   - Identify all inputs these blocks consume from the component's scope

2. **Create `useDragSelection.ts`** in the same directory. The hook signature should be:
   ```ts
   function useDragSelection(params: {
     sectionRef: React.RefObject<HTMLElement>;
     effectiveViewMode: 'split' | 'unified';
     // hunk line map data structures needed for range resolution
   }): {
     dragState: DragState; // use existing type
     handleDragStart: (lineKey: string) => void;
     handleCommentRange: (range: CommentRange) => void;
   }
   ```

3. **Move** the drag state initialization, `dragStateRef`, document-level `mousemove`/`mouseup` `useEffect`, the `trigger-line-comment` listener `useEffect`, and all related `useCallback` handlers into the hook body.

4. **Replace** the extracted code in `FileSection.tsx` with a single hook call:
   ```ts
   const { dragState, handleDragStart, handleCommentRange } = useDragSelection({ sectionRef, effectiveViewMode, ... });
   ```

5. **Verify no stale closures**: ensure handlers inside effects use `useRef` for values that change over time, consistent with the existing `dragStateRef` pattern.

6. **Run `npm run test:unit`** and confirm no failures.

7. **Size check**: `FileSection.tsx` should be noticeably smaller (target ~120-150 lines reduction).

</details>
