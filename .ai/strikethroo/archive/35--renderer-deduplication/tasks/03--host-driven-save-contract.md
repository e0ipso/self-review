---
id: 3
group: "lifecycle-boundaries"
dependencies: [2]
status: "pending"
created: "2026-03-11"
skills:
  - "react-components"
  - "typescript"
---
# Implement Host-Driven Save Contract

## Objective
Adopt the host-driven save flow: when the user triggers save (Finish Review or close-dialog Save & Quit), the renderer constructs the current `ReviewState` and submits it via `review:submit` IPC. Remove any dependency on `review:request` pull semantics from shared package paths.

## Skills Required
- react-components (React context/hook changes)
- TypeScript (IPC types)

## Acceptance Criteria
- [ ] `Finish Review` action causes renderer to call `window.electronAPI` submit with current `ReviewState`
- [ ] Close-dialog "Save & Quit" path also triggers renderer-side submission (not a main-side pull)
- [ ] `review:request` IPC channel is NOT called from `packages/react/src` or deduplicated renderer bridge code
- [ ] `rg "review:request|onRequestReview" src/renderer packages/react/src` returns no matches in shared/package code paths
- [ ] Existing save behavior (XML written to output file) is preserved end-to-end
- [ ] `npm run test:unit` passes

## Technical Requirements
- `src/renderer/` bridge/shell code owns save orchestration
- `packages/react` contexts expose current state via hooks/context; renderer shell reads state and calls IPC
- `ipc-channels.ts` may be updated if `review:request` channel is being retired
- Do not remove `review:request` from `src/shared/ipc-channels.ts` until confirmed unused by `src/main` as well

## Input Dependencies
- Task 02: resolver alignment complete so package imports compile in renderer context

## Output Artifacts
- Updated renderer bridge/shell code implementing host-driven save
- Updated (or confirmed unchanged) `src/main/ipc-handlers.ts` to expect push-only review submission
- Unit test updates if any save-related tests exist

## Implementation Notes

<details>
<summary>Save flow implementation</summary>

**Current flow (pull-based):**
1. User triggers save → main sends `review:request` → renderer sends back `ReviewState`

**Target flow (host-driven):**
1. User triggers save → renderer calls `window.electronAPI.submitReview(reviewState)` → main writes XML and exits

**Steps:**
1. Identify where save is triggered in renderer (likely `App.tsx` or bridge component handling `app:save-and-quit` / toolbar "Finish Review")
2. Ensure `ReviewContext` or `useReviewState` hook exposes a way to read current state synchronously
3. On save trigger, read current state from context and call `window.electronAPI` submit method
4. In `src/main/ipc-handlers.ts`, verify `review:submit` handler writes XML and exits (it likely already does)
5. Remove or no longer wire `review:request` listener in renderer bridge if it was only used for save
6. Run `rg "review:request|onRequestReview" src/renderer packages/react/src` to confirm no remaining references in scope

**Note:** The close-dialog three-way flow (`app:close-requested` → dialog → `app:save-and-quit` or `app:discard-and-quit`) must be verified — the "Save & Quit" branch should also push state, not pull it.
</details>
