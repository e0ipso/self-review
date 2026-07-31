---
id: 4
group: "resume-from-fix"
dependencies: [2, 3]
status: "completed"
created: 2026-02-25
skills:
  - typescript
  - vitest
---

# Unit Tests for resume-matcher and Path Normalization

## Objective

Write Vitest unit tests for `matchResumeComments` and `normalizeResumePath` covering the key scenarios specified in the plan, using inline fixture data (no filesystem access).

## Skills Required

TypeScript, Vitest.

**Meaningful Test Strategy (copy):**
> Write a few tests, mostly integration. Test custom business logic, critical paths, and edge cases. Do NOT test third-party library functionality or trivial getters.

## Acceptance Criteria

- [ ] Test file `src/main/resume-matcher.test.ts` exists
- [ ] Covers all 8 scenarios listed in plan Stage 4 for `matchResumeComments`
- [ ] Covers 3 path normalization scenarios from the plan
- [ ] Tests use inline `DiffFile`/`DiffLine` fixture objects — no filesystem reads
- [ ] All tests pass (`npm run test:unit:main`)

## Technical Requirements

- Test file: `src/main/resume-matcher.test.ts` (colocated with `resume-matcher.ts`)
- Framework: Vitest
- No mocking of the matcher itself — test the pure function directly

## Input Dependencies

- Task 02 (`normalizeResumePath` utility exists)
- Task 03 (`matchResumeComments` function exists)

## Output Artifacts

- `src/main/resume-matcher.test.ts`

## Implementation Notes

<details>
<summary>Detailed instructions and fixture patterns</summary>

Follow the fixture style from `src/main/diff-parser.test.ts`: build minimal `DiffFile`/`DiffHunk`/`DiffLine` objects inline within each test.

### Scenarios to cover

#### matchResumeComments scenarios

1. **No edit above comment** — Build a DiffFile whose context lines are unchanged relative to the original positions. Comment at line 10 should remain at line 10 after matching.

2. **Lines inserted above** — Build a DiffFile with 5 insertion lines above the comment. The context fingerprint is still present but shifted down by 5. Comment should relocate from line 10 to line 15.

3. **Lines deleted above** — Inverse of scenario 2. Comment relocates upward.

4. **Comment line itself changed** — The line the comment was on is now a deletion or no longer present; context lines around it are gone or insufficient. Comment should be `orphaned: true`.

5. **File-level comment** — `lineRange: null`. Should pass through unchanged regardless of diff content.

6. **Renamed file** — `DiffFile` has `oldPath: 'old-name.ts'`, `newPath: 'new-name.ts'`. Comment references `old-name.ts`. Should still match via the `oldPath` check.

7. **Sparse context (all-additions file)** — `DiffFile` has only `type: 'addition'` lines; no context lines. Comment should be `orphaned: true`.

8. **Multi-line comment** — `lineRange` spans 3 lines (e.g., start=10, end=12). After 5 insertions above, relocated range should be start=15, end=17 (span preserved).

#### normalizeResumePath scenarios

1. `normalizeResumePath('claude-code-dx-tools.md')` → `'claude-code-dx-tools.md'` (basename passthrough)
2. `normalizeResumePath('src/foo/bar.ts')` → `'bar.ts'` (relative path → basename)
3. `normalizeResumePath('/home/user/Downloads/review.md')` → `'review.md'` (absolute path → basename)

### Helper to build minimal DiffFile fixture

```typescript
function makeDiffFile(lines: Array<{ type: 'context' | 'addition' | 'deletion', content: string, old: number | null, new: number | null }>): DiffFile {
  return {
    newPath: 'test.ts',
    oldPath: 'test.ts',
    changeType: 'modified',
    hunks: [{
      oldStart: 1, oldLines: lines.filter(l => l.old !== null).length,
      newStart: 1, newLines: lines.filter(l => l.new !== null).length,
      lines: lines.map(l => ({
        type: l.type,
        content: l.content,
        oldLineNumber: l.old,
        newLineNumber: l.new,
      })),
    }],
  };
}
```

Adjust field names to match the actual `DiffFile`/`DiffHunk`/`DiffLine` type definitions in `src/shared/types.ts`.

</details>
