---
id: 11
group: "filesystem-authorization"
dependencies: [3, 10]
status: "pending"
created: 2026-10-01
skills:
  - nodejs-filesystem
  - secure-coding
complexity_score: 7
complexity_notes: "Shared authorization (reviewed membership, control files, anchors) plus physical containment and transactional replacement; security-critical."
execution_profile: "complex-architecture"
---
# Authorize Apply against the original reviewed diff and mutate files safely (R04, A3, A4)

## Objective
Suggestion Apply only changes a file that was in the original reviewed diff, is not a repository control file, and resolves physically inside the destination without leaf or ancestor symlink redirection; anchors are validated before any I/O; empty proposals delete the range; the write is transactional so a refusal or failure never leaves the target modified.

## Skills Required
Node.js filesystem semantics and secure-coding authorization design.

## Acceptance Criteria
- [ ] `ReviewSession` gains an authoritative, immutable `reviewedPaths` set captured when the session's diff is committed (`commitReviewStart`/remote bootstrap/directory start) from the loaded diff files (both `newPath` and `oldPath` where relevant). Resume placeholders, client-supplied state and later pushes cannot extend it.
- [ ] `applySuggestionForSession` (`review-handlers.ts:333`) refuses (with distinct refusal reasons added to `ApplyRefusalReason`) when: the path is not in `reviewedPaths` (`not-reviewed`); the path or any segment is a repository control path (`.git` dir/file at any depth, `.gitmodules`, `.gitattributes`? — decide and document; at minimum `.git/**`) (`control-file`); the anchor fails `validateLineAnchor` from task 3 or exceeds the file's line count (`invalid-anchor`); the comment/suggestion is not one the session knows as actionable, if such binding is available (otherwise document why the anchor+original check is the binding).
- [ ] Empty `proposedCode` deletes the anchored lines (no blank line inserted); trailing-newline semantics are specified in JSDoc and tested (proposal with/without trailing `\n`, file with/without final newline). Probe: `before\nremove\nafter\n` with empty proposal on line 2 → `before\nafter\n`.
- [ ] Physical containment in the shared engine (`apply-suggestion.ts:156,169,214`): resolve the destination root with `realpath`; walk each ancestor segment with `lstat` refusing symlinks; open the target with `O_NOFOLLOW`; refuse non-regular files and hardlinked files (nlink > 1) (`unsafe-target`); record `dev/ino/size/mtime` from `fstat`.
- [ ] Transactional write: read original via the opened fd, compare original bytes (concurrency check), write the new content to a temp file in the same directory with the original mode (and ownership when possible), `fsync`, re-`lstat` the target to confirm identity (`dev/ino`) unchanged, then `rename` over it. Any failure removes the temp file and leaves the target byte-identical; the result is never `refused` after a mutation. Injected ENOSPC test proves the target is untouched.
- [ ] Electron (`src/main/ipc-handlers.ts:96`) and serve both rely on the core checks (no transport-only validation needed for correctness; serve's existing integer checks may remain as input validation).
- [ ] Tests with real temp repos: reviewed file applies; unreviewed sentinel and `.git/config` refused with bytes unchanged; resume-placeholder path refused; NaN/Infinity/0/fractional/reversed/both-sided anchors refused before I/O; leaf and ancestor symlink escapes refused with outside sentinel unchanged; identity change between read and commit refused; partial-write fault leaves target intact; deletion proposal. `npm run test:unit` passes.
- [ ] React: suggestions on files not in the reviewed diff (placeholders) do not show an active Apply control (check `ReviewContext.tsx:200`, `FileSectionBody.tsx:28`).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/core/src/apply-suggestion.ts`, `packages/core/src/review-handlers.ts` (session shape + apply handler + where the diff is committed), `packages/types/src/index.ts` (refusal reasons), `src/main/ipc-handlers.ts` (only if needed), React Apply control gating (`SuggestionApplyControl.tsx`, `FileSectionBody.tsx`).
- `setApplyDestination` must still reject directories inside a temporary clone; the chosen destination is a separate root from the read-only source.

## Input Dependencies
Task 3 (`validateLineAnchor`), task 10 (`packages/core/src/safe-fs.ts` no-follow/atomic-replace primitives — reuse them; extend them there if Apply needs more, rather than duplicating).

## Output Artifacts
`session.reviewedPaths`, hardened `applySuggestion`, new refusal reasons (task 18 reuses membership for image reads).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R04, `docs/security-audit-2026-10-01.md` A3/A4, `docs/security-audit-2026-10-01-sol/sol-p3b-apply.md`, and probes `docs/security-audit-2026-10-01/probes.cjs`, `docs/security-audit-2026-10-01-sol/claude-probe-apply.ts`. Reproduce the `.git/config` and symlink probes against the handler first (RED).
2. PRD Section 5.4.8 (`docs/PRD.md`) documents the apply boundaries; keep its guarantees (explicit destination root, byte-exact original match, never consults CWD).
3. Rename replaces the inode: preserve mode via `fchmod` on the temp file; attempt `fchown` to original uid/gid and ignore EPERM only when uid/gid already match; refuse (`unsupported-target`) if ownership differs and cannot be preserved. Document the policy in JSDoc.
4. Paths: normalize with `path.posix` semantics for session-relative paths; reject absolute paths and `..` segments before resolving.
5. Concurrency: tasks 14, 15 and 16 run in the same phase (`src/main/main.ts`/`menu.ts`/`ipc-handlers.ts` save paths, `packages/serve/*`, remote/forge files). Keep `ipc-handlers.ts` edits limited to the apply handler; re-read before editing; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration on real temp repositories. Test authorization edge cases and failure atomicity; do not test Node's fs itself.
</details>
