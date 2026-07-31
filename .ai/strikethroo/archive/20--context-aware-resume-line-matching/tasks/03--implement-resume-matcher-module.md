---
id: 3
group: "resume-from-fix"
dependencies: [1]
status: "completed"
created: 2026-02-25
skills:
  - typescript
---

# Implement resume-matcher.ts Context-Aware Line Matching Module

## Objective

Create the `src/main/resume-matcher.ts` pure-function module that relocates line-level `ReviewComment` objects to their correct positions in the current diff using a context-line fingerprint heuristic, and mark comments that cannot be confidently relocated as `orphaned: true`.

## Skills Required

TypeScript, algorithm/data-structure work with the existing `DiffFile`/`DiffLine` types.

## Acceptance Criteria

- [ ] `src/main/resume-matcher.ts` exists and exports `matchResumeComments(comments: ReviewComment[], diffFiles: DiffFile[]): ReviewComment[]`
- [ ] File-level comments (null `LineRange`) pass through unchanged
- [ ] Line-level comments are relocated using a 3-above / 3-below context-line window of `type === 'context'` lines
- [ ] Match threshold is 0.6 (named constant `MATCH_THRESHOLD`)
- [ ] Window size is 3 (named constant `ANCHOR_WINDOW`)
- [ ] When fewer than 2 context lines are available for the anchor window, the comment is marked `orphaned: true`
- [ ] When multiple candidates score above threshold, the one closest to the original line number is chosen
- [ ] When score is below threshold, the comment is marked `orphaned: true` with `LineRange` preserved unchanged
- [ ] For renamed files, both `DiffFile.oldPath` and `DiffFile.newPath` are checked using path normalization (reuse `normalizeResumePath` from Task 02)
- [ ] `matchResumeComments` is called in `src/main/main.ts` immediately after the XML is parsed and before `setResumeComments` is called
- [ ] All existing unit tests pass

## Technical Requirements

- New file: `src/main/resume-matcher.ts`
- Modified file: `src/main/main.ts` — one call insertion in the resume-from block
- Imports: `ReviewComment`, `DiffFile`, `DiffLine` from `src/shared/types.ts`
- No new npm dependencies

## Input Dependencies

- Task 01 completed (the resume-from block in `main.ts` is now mode-agnostic; the matcher is inserted into this block)
- `normalizeResumePath` from Task 02 (may be implemented in parallel; if so, define the utility in `src/shared/path-utils.ts` and import from there in both tasks)

## Output Artifacts

- `src/main/resume-matcher.ts` — complete, exported pure function
- Updated `src/main/main.ts` — one new call `matchResumeComments(rawComments, diffFiles)` before `setResumeComments`

## Implementation Notes

<details>
<summary>Detailed instructions</summary>

### Algorithm Overview

For each `ReviewComment`:

1. **File-level** (`LineRange === null`): return as-is.
2. **Find target DiffFile**: match `comment.filePath` against `diffFile.newPath ?? diffFile.oldPath` using exact match, then basename fallback (same logic as renderer). If no file found → `orphaned: true`, return unchanged.
3. **Collect all DiffLines** from the matched `DiffFile` (flatten all hunks: `diffFile.hunks.flatMap(h => h.lines)`).
4. **Determine original line number**: use `comment.lineRange.newLineStart` if `comment.lineRange.side === 'new'`, else `comment.lineRange.oldLineStart`.
5. **Build anchor fingerprint**:
   - Look at the ANCHOR_WINDOW (3) lines above and below the original line number in the `DiffLine` array (by matching `newLineNumber` or `oldLineNumber` depending on side).
   - Prefer lines with `type === 'context'`. Collect up to 6 total (3 above + 3 below).
   - If fewer than 2 context lines available → `orphaned: true`, return unchanged.
   - Fingerprint = array of `{ content: string, relOffset: number }` where `relOffset` is the offset from the commented line (negative = above, positive = below).
6. **Search for best match position** in the current diff's lines:
   - For each candidate line of matching type, count how many fingerprint entries appear at the expected relative offsets (compare by `content` trimmed).
   - Score = matching entries / total fingerprint entries.
   - Collect all candidates with score ≥ MATCH_THRESHOLD (0.6).
7. **Select winner**:
   - If zero candidates → `orphaned: true`, return unchanged.
   - If one or more candidates → pick the one whose line number is closest to the original.
8. **Update LineRange**: compute new absolute line number from the winner, preserve span length (end − start), clamp to available lines in the file, set updated `newLineStart`/`newLineEnd` (or `oldLineStart`/`oldLineEnd`).

### Named Constants

```typescript
const ANCHOR_WINDOW = 3;
const MATCH_THRESHOLD = 0.6;
const MIN_ANCHOR_LINES = 2;
```

### Wire Into main.ts

In the resume-from block (after Task 01's guard change):

```typescript
const rawComments = parseReviewXml(resumeXml); // existing call
const matchedComments = matchResumeComments(rawComments, currentDiffFiles);
setResumeComments(matchedComments); // existing call
```

`currentDiffFiles` is whatever the current session produced (from `parseDiff`, `scanFile`, etc.) — it should already be in scope at that point in `main.ts`.

### Type Safety Notes

- `ReviewComment.lineRange` is typed as `LineRange | null` in `src/shared/types.ts`.
- `ReviewComment.orphaned` is typed as `boolean | undefined` — set it to `true` for orphaned comments; do not set it for non-orphaned ones (leave undefined).
- `DiffLine.type` values: `'context' | 'addition' | 'deletion'`.

</details>
