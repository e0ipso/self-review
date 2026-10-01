---
id: 13
group: "resource-budgets"
dependencies: [3, 4]
status: "pending"
created: 2026-10-01
skills:
  - nodejs-filesystem
  - typescript
complexity_score: 6
complexity_notes: "Budgets must be enforced before allocation across several loaders and must surface honest incomplete/unsupported states."
execution_profile: "standard-implementation"
---
# Bound source, guide and resume work before allocation (R14 backend, resource hardening)

## Objective
Directory walking prunes ignored directories before visiting them, binary detection samples a bounded prefix instead of reading whole files, untracked synthetic diffs do not follow symlinks outside the source, and aggregate source/guide/resume work has finite, documented budgets enforced before expensive allocation. Exceeding a budget is reported visibly and never presented as a complete (empty or truncated) review.

## Skills Required
Node.js filesystem streaming/bounded reads and TypeScript.

## Acceptance Criteria
- [ ] `packages/core/src/directory-scanner.ts:42–72` applies ignore patterns to directories during traversal (an ignored `node_modules/` with 10k files is never `readdir`-ed — test with a spy/fs counter), skips symlinks/FIFOs/devices (as today), and stops enumeration at a documented file-count budget with an explicit "limit exceeded" result.
- [ ] Binary detection reads at most a fixed prefix (e.g. 8 KiB) via an fd; file content for synthetic diffs is read only for files within a per-file byte budget; files over the budget are listed as too-large entries rather than read whole.
- [ ] `packages/core/src/synthetic-diff.ts:68` does not follow untracked symlinks: an untracked symlink is represented by its link text (as Git does) and outside sentinel content never enters the diff (test).
- [ ] Aggregate budgets (total bytes read for source, guide file size, resume XML file size, resume attachment count) are named constants in one module (e.g. `packages/core/src/input-budgets.ts`), documented, and checked before reading (via `stat` size) — reuse existing `max-files`/`max-total-lines` config thresholds for transport decisions and keep them distinct from safety budgets. Do not add new user config settings.
- [ ] Limit failures surface through the existing diagnostics channel (`DiffLoadPayload.diagnostics` from task 4, guide warning on stderr, resume error via the typed XML error from task 3); the UI does not claim "no changes" when a limit was hit.
- [ ] Tests with real temp directories: large ignored tree pruned; large binary sampled (bounded read verified by counting bytes read through an injected reader or by a sparse multi-GB file read time bound); oversized guide and resume rejected before parse; symlinked untracked file. `npm run test:unit` passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/core/src/directory-scanner.ts`, `packages/core/src/synthetic-diff.ts`, `packages/core/src/staged-untracked.ts` if it reads untracked content, `packages/core/src/guide-loader.ts`, the resume-file reader (find with `grep -rn "readFileSync\|readFile(" packages/core/src/startup-mode.ts packages/core/src/xml-parser.ts`), new `packages/core/src/input-budgets.ts`.
- Do not touch `xml-serializer.ts`, `review-publisher.ts`, `safe-fs.ts` (task 10) or attachment reading (task 20).

## Input Dependencies
Task 3 (typed XML errors, resume parsing), task 4 (diagnostics channel, loader structure).

## Output Artifacts
`input-budgets.ts` constants (task 20 reuses them for attachment byte limits).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R14 and `docs/security-audit-2026-10-01.md` "Restrict automatic reads and bound resource use".
2. Ignore matching for directories: the ignore filter (`createIgnoreFilter`) likely matches file paths; test directory paths with a trailing `/` against it (gitignore semantics) before descending.
3. Suggested budgets (justify in code comments): max scanned entries 50,000; max bytes read for synthetic content 64 MiB aggregate; per-file 5 MiB; guide 1 MiB; resume XML 16 MiB. Prefer values aligned with existing limits (serve body 32 MB, image 10 MB).
4. Git diff output already has a 50 MB capture ceiling — make exceeding it produce a diagnostic rather than an exception that looks like an empty review, if it currently doesn't.
5. Concurrency: tasks 10 (publisher, `xml-serializer.ts`, `fetch-comments.ts`) and 12 (React) run in the same phase. Re-read before editing shared files (`index.ts`); never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration on real temp directories. Test the budgets and pruning; skip trivial constant tests.
</details>
