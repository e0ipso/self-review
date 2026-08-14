---
id: 2
group: "resume-from-fix"
dependencies: [1]
status: "completed"
created: 2026-02-25
skills:
  - typescript
---

# Add Path Normalization and Update Renderer Merge Logic

## Objective

Add a `normalizeResumePath` pure utility that extracts the basename from any file path, then update `ReviewContext.tsx`'s `onResumeLoad` handler to use basename-fallback matching so comments from a file-mode or directory-mode XML are correctly matched to files in the current session's diff.

## Skills Required

TypeScript, React renderer logic.

## Acceptance Criteria

- [ ] A `normalizeResumePath(filePath: string): string` function exists (co-located in a suitable utility file or at the top of `resume-matcher.ts` — see Task 03 notes)
- [ ] `onResumeLoad` in `ReviewContext.tsx` first attempts exact path match; if no match is found it falls back to basename comparison
- [ ] Basename fallback is only applied when exactly one file in the current diff has a matching basename (collision guard: if multiple files share the same basename, the comment is not merged — it is dropped/ignored)
- [ ] File-level comments (null `LineRange`) are handled the same way as line comments for path matching
- [ ] All existing unit tests pass

## Technical Requirements

- File: `src/renderer/context/ReviewContext.tsx` — update the `onResumeLoad` merge loop
- Utility: `normalizeResumePath` — may live in a shared utility or at the top of `resume-matcher.ts` (coordinate with Task 03 to avoid duplication; if Task 03 is in progress simultaneously, place the utility in its own small file under `src/main/` and export it, then import from both sites)

## Input Dependencies

- Task 01 completed (mode guard removed so resume data actually arrives at the renderer)

## Output Artifacts

- `normalizeResumePath` utility (location TBD — see notes)
- Updated `ReviewContext.tsx` with basename-fallback merge

## Implementation Notes

<details>
<summary>Detailed instructions</summary>

### Step 1 — Define normalizeResumePath

```typescript
export function normalizeResumePath(filePath: string): string {
  // Extract the last path segment (works for both POSIX and Windows paths)
  return filePath.split(/[\\/]/).pop() ?? filePath;
}
```

Where to place it: if Task 03 (`resume-matcher.ts`) is being worked on simultaneously, coordinate so the function lives in `src/main/resume-matcher.ts` and is imported into the renderer side. If working alone, place it in a small `src/shared/path-utils.ts` (create only if there is no existing shared utility file). The renderer must be able to import it — the renderer cannot import from `src/main/`, so a shared location is preferred if it needs to be used in both main and renderer.

**Note**: Given the architecture (main process does matching, renderer does final merge), `normalizeResumePath` used in the renderer for the merge-lookup step is separate from its use in the main process matcher. It is fine to duplicate the one-liner if sharing across the process boundary is architecturally awkward, but exporting from `src/shared/` avoids any duplication.

### Step 2 — Update onResumeLoad in ReviewContext.tsx

Find the `onResumeLoad` handler (likely inside the `useEffect` that listens on `resume:load`). It currently does something like:

```typescript
comments.forEach(comment => {
  const fileState = fileStates.find(f => f.path === comment.filePath);
  if (fileState) {
    // attach comment
  }
});
```

Update to:

```typescript
comments.forEach(comment => {
  // Attempt exact match first
  let fileState = fileStates.find(f => f.path === comment.filePath);

  // Fallback: basename comparison when exact match fails
  if (!fileState) {
    const commentBasename = normalizeResumePath(comment.filePath);
    const candidates = fileStates.filter(
      f => normalizeResumePath(f.path) === commentBasename
    );
    // Only merge if unambiguous (exactly one candidate)
    if (candidates.length === 1) {
      fileState = candidates[0];
    }
  }

  if (fileState) {
    // attach comment (same logic as before)
  }
});
```

### Step 3 — Verify

Run `npm run test:unit` to confirm no regressions. The renderer tests that cover `ReviewContext` (if any) should still pass; this is a purely additive fallback path.

</details>
