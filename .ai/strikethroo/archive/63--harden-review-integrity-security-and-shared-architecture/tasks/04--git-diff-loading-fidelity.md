---
id: 4
group: "git-diff"
dependencies: []
status: "completed"
created: 2026-10-01
skills:
  - git
  - typescript
complexity_score: 7
complexity_notes: "Parser contract spans binary/copy/conflict metadata, hunk accounting and invocation normalization; R12 deduplication folded in because it shares the loader and real-Git fixtures."
execution_profile: "complex-architecture"
---
# Enforce the diff format contract and one entry per reviewed path (R06, R12)

## Objective
`git diff` output reaching the parser is always parser-compatible, the parser never invents or silently drops changes, unsupported formats produce a visible diagnostic instead of an empty successful review, and the loader produces exactly one entry per path when tracked and synthetic untracked diffs overlap. Remove the process-exiting synchronous Git helpers.

## Skills Required
Git diff/plumbing semantics and TypeScript parser implementation.

## Acceptance Criteria
- [x] Trailing newline of real Git output no longer becomes a phantom context line; a `1/1` hunk yields exactly one old and one new line.
- [x] Hunk accounting is validated against the `@@ -a,b +c,d @@` header; malformed/unrecognized lines are not treated as context — a mismatch produces a parse diagnostic.
- [x] `GIT binary patch` (from `--binary`) is recognized as a binary modification; exact copies (`copy from`/`copy to`, `similarity index 100%`) appear as copied files and edited copies are labelled as copies (add `'copied'` to the change-type union in `@self-review/types` if absent, and render it in the React file tree/header badge).
- [x] Combined conflict output (`diff --cc` / `diff --combined`) is reported as unsupported with a visible diagnostic; it is never omitted or merged into the previous file, and a review consisting only of such output is not shown as an empty success.
- [x] Every git diff invocation forces parser-compatible output regardless of user config: `--no-color`, `--no-ext-diff`, `--no-textconv` where applicable, explicit `--src-prefix=a/ --dst-prefix=b/` (or `-c diff.noprefix=false -c diff.mnemonicPrefix=false`), and `-c color.ui=never`. Probes with `color.ui=always` and `diff.noprefix=true` now parse correctly.
- [x] User-supplied output-format flags the parser cannot consume (`--stat`, `--numstat`, `--name-only`, `--name-status`, `--word-diff*`, `--color-words`, `--raw`, `--summary`, `--shortstat`, `--dirstat`, `--patch-with-stat` etc.) are rejected with a visible diagnostic naming the flag, rather than yielding an empty review.
- [x] `git-diff-loader.ts` deduplicates tracked vs synthetic untracked entries by path with tracked taking precedence, before any session state is created; documented local untracked visibility is otherwise unchanged. Regression: `git rm --cached f` + untracked `f`, compared against HEAD with `--no-renames`, yields one deterministic entry, with untracked visibility on and off.
- [x] Process-exiting synchronous helpers in `packages/core/src/git.ts` (lines ~27–87 call `process.exit`) are removed or replaced by throwing equivalents; remaining callers (including the app's re-export of `getGitDiffStats`, if any) are updated. No compatibility wrapper.
- [x] Regression tests use real Git in disposable repos (`mkdtemp`): trailing newline, binary with `--binary`, exact/edited copy with `-C --find-copies-harder`, merge conflict, `color.ui=always`, `diff.noprefix=true`, unsupported flag, duplicate path. `npm run test:unit` and `npm run typecheck:packages` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/core/src/diff-parser.ts`, `packages/core/src/git.ts`, `packages/core/src/git-diff-loader.ts`, `packages/core/src/git-diff-args.ts` (only the unsupported-format classification), `packages/types/src/index.ts`, minimal React badge support for `'copied'`, diagnostics surfaced via the existing `DiffLoadPayload` (add optional `diagnostics: string[]` if no channel exists, render in `EmptyDiffMessage`/a banner).
- Keep the browser export `packages/core/src/browser.ts` compiling (task 23 handles its Buffer use).

## Input Dependencies
None.

## Output Artifacts
Parser-compatible invocation, `DiffLoadPayload.diagnostics`, `'copied'` change type, dedup in loader (used by tasks 13, 18, 19).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R06 and R12 and `docs/codebase-audit-2026-10-01/core-probes.cjs` for reproductions. Locations: `diff-parser.ts:11,36,108,177–188`, `git.ts:117`, `git-diff-loader.ts:38–47`.
2. Phantom line: the parser splits on `\n`; drop the final empty element only when the input ends with `\n`. Use the hunk header counts to know when a hunk is complete; lines after completion that aren't a new header/`diff --git` are diagnostics, not context. `\ No newline at end of file` must remain supported.
3. Binary: `GIT binary patch` follows `index ...` lines; treat like the existing `Binary files ... differ` case (isBinary: true, no hunks).
4. Copies: headers `similarity index N%`, `copy from <p>`, `copy to <p>`. Paths may be C-quoted — reuse the existing quoted-path decoding.
5. Conflicts: `diff --cc <path>`/`diff --combined <path>` starts a new file section. Recognize and emit a diagnostic `"<path>: combined (merge conflict) diff output is not supported"`; skip its lines until the next file header.
6. Find the main `git diff` runner (`git.ts:117` region) and the shared args builder; add normalization flags in one place used by all diff invocations (initial load, expansion, remote). Do not alter user pathspecs/revisions.
7. Unsupported format flags: classify in `git-diff-args.ts` using the existing classifier (which understands option arity). Return diagnostics from the loader; surface in desktop and serve via the payload. The empty-state message must not claim "no changes" when diagnostics exist.
8. `git.ts` `process.exit` helpers: check `packages/core/src/index.ts` exports and `grep -rn` for callers in `src/` and `packages/`. Removing exported helpers is allowed (breaking changes approved); update `index.ts` and any re-export in the app.
9. Concurrency: other tasks run in parallel (React preview/session/comment tasks). Only edit the React files needed for the `'copied'` badge and diagnostics display; re-read before editing; never revert others' changes or the unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration against real Git output. Test custom parsing logic and edge cases; no tests for Git itself. Combine into a fixture-driven suite.
</details>
