---
id: 3
group: "filesection-refactor"
dependencies: []
status: "completed"
created: "2026-03-11"
skills: ["react-components", "typescript"]
---
# Extract `useExpandContext` Hook from `FileSection`

## Objective
Extract the ~170-line context expansion logic from `FileSection.tsx` into a `useExpandContext` hook that manages per-hunk budget tracking, scroll compensation, git fetch caching, and hunk trimming.

## Skills Required
- react-components
- typescript

## Acceptance Criteria
- [ ] `useExpandContext.ts` exists in `packages/react/src/components/DiffViewer/`
- [ ] Hook accepts `file`, `filePath`, `isExpandable`, and `adapter` as inputs
- [ ] Hook returns `expandLoading`, `totalLines`, `handleExpandContext`, and `sectionRef`
- [ ] The `useLayoutEffect` for scroll compensation is inside the hook
- [ ] The long `useCallback` for expand handling is inside the hook
- [ ] `FileSection.tsx` is materially smaller; all expand-context logic replaced by a single hook call
- [ ] `npm run test:unit` passes

## Technical Requirements
- Source file: `packages/react/src/components/DiffViewer/FileSection.tsx`
- New file: `packages/react/src/components/DiffViewer/useExpandContext.ts`
- `sectionRef` must be created inside this hook (it is used only for scroll compensation within this logic) and returned so `FileSection` can pass it to layout components that need the `data-file-path` attribute anchor
- Consistent with existing hook patterns: use `useCallback` with explicit dependencies, `useRef` for mutable stable references

## Input Dependencies
None

## Output Artifacts
- `packages/react/src/components/DiffViewer/useExpandContext.ts` — new hook
- Updated `packages/react/src/components/DiffViewer/FileSection.tsx` — uses the hook

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

1. **Read `FileSection.tsx`** in full to identify the expand-context block:
   - Look for state variables: `expandLoading`, `totalLines`, and related per-hunk tracking state
   - Find the `handleExpandContext` `useCallback` (long block calling IPC for more context)
   - Find the `useLayoutEffect` that handles scroll compensation after context expansion
   - Find `sectionRef` — confirm it is ONLY used by the expand-context logic (scroll compensation + `data-file-path` attribute for navigation anchoring)

2. **Create `useExpandContext.ts`** in the same directory. Hook signature:
   ```ts
   function useExpandContext(params: {
     file: DiffFile;
     filePath: string;
     isExpandable: boolean;
     adapter: ReviewAdapter; // or whatever the adapter type is
   }): {
     expandLoading: boolean;
     totalLines: number;
     handleExpandContext: (hunkIndex: number, direction: 'up' | 'down' | 'all') => void;
     sectionRef: React.RefObject<HTMLElement>;
   }
   ```
   Adjust types to match what is actually used in `FileSection.tsx`.

3. **Move** all expand-context state, the `handleExpandContext` callback, and the scroll-compensation `useLayoutEffect` into the hook body. Create `sectionRef` inside the hook.

4. **Replace** in `FileSection.tsx` with a single hook call:
   ```ts
   const { expandLoading, totalLines, handleExpandContext, sectionRef } = useExpandContext({ file, filePath, isExpandable, adapter });
   ```

5. **Thread `sectionRef`** to child layout components that need it for the `data-file-path` attribute anchor (these will be created in Task 4, but for now `FileSection.tsx` continues to use it directly on its root element).

6. **Run `npm run test:unit`** and confirm no failures.

7. **Size check**: `FileSection.tsx` should be substantially reduced, targeting roughly 170 lines removed.

</details>
