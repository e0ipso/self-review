---
id: 1
group: "single-file-review-adapter"
dependencies: []
status: "completed"
created: 2026-05-02
skills:
  - typescript
  - react-components
---

# Add `adapter?: Partial<ReviewAdapter>` prop to SingleFileReview

## Objective

Expose an optional `adapter?: Partial<ReviewAdapter>` prop on `SingleFileReview` so consumers can supply optional adapter methods (`expandContext`, `loadFileContent`, `loadImage`, `readAttachment`, `loadResumedComments`, `submitReview`, `changeOutputPath`). The internally-generated `loadDiff` (derived from `file` + `source`) must always win over any consumer-supplied `loadDiff`.

## Skills Required

- `typescript` — extend `SingleFileReviewProps` with a typed optional prop and update the `useMemo` return type.
- `react-components` — modify the `useMemo` adapter construction and update its dependency array.

## Acceptance Criteria

- [ ] `SingleFileReviewProps` (in `packages/react/src/SingleFileReview.tsx`) declares `adapter?: Partial<ReviewAdapter>`.
- [ ] The `useMemo` that builds the internal adapter spreads the consumer's `adapter` first and applies the internally-generated `loadDiff` last, so the internal `loadDiff` always wins.
- [ ] The `useMemo` dependency array includes the consumer-supplied `adapter` reference.
- [ ] The new prop is forwarded through the component (added to the destructured props in the `forwardRef` callback).
- [ ] When `adapter` is omitted, the merged adapter is functionally identical to the current implementation (only `loadDiff` is present).
- [ ] JSDoc on the new prop documents:
  1. It accepts a partial `ReviewAdapter`.
  2. Consumer-supplied `loadDiff` is intentionally ignored (file/source props are the source of truth).
  3. The consumer is expected to memoize the adapter object, mirroring `ReviewPanel`.
- [ ] `npm run typecheck` from the workspace root passes.
- [ ] `npm run lint` from the workspace root passes.

## Technical Requirements

- Source file: `packages/react/src/SingleFileReview.tsx`.
- Type to import (already imported): `ReviewAdapter` from `./adapter`.
- The `useMemo` currently lives at lines 77–82. The merge pattern should be:

  ```ts
  const mergedAdapter: ReviewAdapter = useMemo(() => ({
    ...adapter,
    loadDiff: async (): Promise<DiffLoadPayload> => ({
      files: [file],
      source: source || { type: 'file', sourcePath: file.newPath || file.oldPath },
    }),
  }), [file, source, adapter]);
  ```

  The spread-first / `loadDiff`-last order is required and must not be flipped — that is the mechanism by which the internal `loadDiff` wins.

- No new exports, no new files, no changes to `packages/react/src/index.ts`, no changes to `packages/react/src/adapter.ts`.

## Input Dependencies

None. The `ReviewAdapter` interface (`packages/react/src/adapter.ts`) is already structured so that every method except `loadDiff` is optional, so `Partial<ReviewAdapter>` is a clean fit without adapter-side changes.

## Output Artifacts

- Updated `packages/react/src/SingleFileReview.tsx` with the new prop, merged-adapter `useMemo`, and JSDoc.

## Implementation Notes

<details>

1. Read `packages/react/src/SingleFileReview.tsx` end-to-end first so you can preserve surrounding behavior (the `forwardRef`, the `ConfigProvider` / `ReviewProvider` / `DiffNavigationProvider` / `TooltipProvider` nesting must remain unchanged).

2. Update `SingleFileReviewProps`:
   - Add the field after the existing optional props. Suggested position: between `onReviewChange` and `className`, but anywhere in the optional block is acceptable. JSDoc above the field:

     ```ts
     /**
      * Optional partial `ReviewAdapter`. Consumers use this to wire optional adapter methods
      * such as `expandContext`, `loadFileContent`, `loadImage`, `readAttachment`,
      * `loadResumedComments`, `submitReview`, and `changeOutputPath`.
      *
      * Note: a consumer-supplied `loadDiff` is intentionally ignored — `file` and `source`
      * are the source of truth in single-file mode. Memoize this object on the consumer side
      * to avoid unnecessary re-renders, the same way `ReviewPanel` expects.
      */
     adapter?: Partial<ReviewAdapter>;
     ```

3. Pull `adapter` out of the destructured props in the `forwardRef` callback (alongside `file`, `source`, `config`, etc.).

4. Replace the existing `useMemo` so it merges the consumer adapter underneath the internal `loadDiff`:

   ```ts
   const mergedAdapter: ReviewAdapter = useMemo(() => ({
     ...adapter,
     loadDiff: async (): Promise<DiffLoadPayload> => ({
       files: [file],
       source: source || { type: 'file', sourcePath: file.newPath || file.oldPath },
     }),
   }), [file, source, adapter]);
   ```

   - Rename the local from `adapter` (the const) to `mergedAdapter` because the prop is now also called `adapter` — the rename avoids shadowing.
   - Pass `mergedAdapter` to `<ReviewAdapterProvider adapter={...}>`.

5. Verify with `npm run typecheck` and `npm run lint` from the workspace root.

6. Do not add runtime warnings for consumer-supplied `loadDiff`. The plan calls this out explicitly: type signature + JSDoc are sufficient.

7. Do not modify `packages/react/AGENTS.md`. It contains no `SingleFileReview` example, so per the plan no documentation update is needed there.

</details>
