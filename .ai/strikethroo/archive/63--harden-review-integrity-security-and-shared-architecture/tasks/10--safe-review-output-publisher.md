---
id: 10
group: "output-publication"
dependencies: [3]
status: "completed"
created: 2026-10-01
skills:
  - nodejs-filesystem
  - secure-coding
complexity_score: 7
complexity_notes: "Multi-file transactional publication with no-follow semantics, permission preservation and interruption safety; consumed by three hosts."
execution_profile: "complex-architecture"
---
# Build one safe review-output publisher in core (R01 core, R11 staging, A5 output links, A9)

## Objective
A single core publisher validates the complete review document before any filesystem side effect, stages attachments without following links or overwriting assets the previous document references, then atomically publishes the XML as the commit point. Failures leave the previous XML/assets usable and report structured, actionable errors. `fetch-comments` uses it now; desktop and serve switch to it in tasks 14 and 15.

## Skills Required
Node.js filesystem semantics (O_NOFOLLOW/O_EXCL, rename atomicity, modes, lstat/fstat identity) and secure-coding for link-following attacks.

## Acceptance Criteria
- [x] New `packages/core/src/review-publisher.ts` exports `publishReview(state, outputPath, options)` returning `{ outputPath, assetPaths }` or throwing `ReviewPublishError` with `code` (`'validation-failed' | 'xml-illegal-character' | 'output-is-directory' | 'permission-denied' | 'no-space' | 'unsafe-link' | 'unsupported-target' | 'io-error'`), a human-readable `message`, and validation details as strings (never `[object Object]`).
- [x] Order: build XML from the in-memory state with final asset references → validate against the XSD (existing validation, including the documented "validator failed to load" exception) → stage new attachment files under `.self-review-assets/` with exclusive create + no-follow (`fs.openSync(p, O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW, mode)`) using new unique names, never overwriting an existing asset → write XML to a temp file in the same directory (exclusive, no-follow) → `fsync` → `rename` over the output (commit point). On any failure before the rename, remove only files staged by this attempt.
- [x] The asset directory is verified with `lstat` to be a real directory (not a symlink) owned by the process user, created if missing with `mkdir` (mode 0o755 or derived from umask); a symlinked `.self-review-assets` or a pre-existing link at a staged filename causes `unsafe-link`, writes nothing outside, and leaves the previous output intact.
- [x] Output leaf policy via an option `outputOrigin: 'explicit' | 'inherited'`: for `inherited` (project config/default), a symlink at the output path or an output path outside the inherited base directory (physically, via `realpath` of the parent) is refused with `unsafe-link`; for `explicit` (reviewer-chosen CLI/dialog path) a symlinked leaf is also refused rather than followed (document it), but an explicit directory outside the project is allowed. Existing output file mode is preserved on replacement; a hardlinked existing output (nlink > 1) is refused with `unsupported-target` rather than silently breaking the link.
- [x] `serializeReview` no longer writes files (pure: state → XML string + asset plan); `persistAttachments`/`writeAttachments` side effects move into the publisher. `checkWritability` is replaced by publisher error reporting (remove it if no longer used; update exports).
- [x] `packages/core/src/fetch-comments.ts` publishes through `publishReview`.
- [x] Tests (`packages/core/src/review-publisher.test.ts`) with real temp dirs: success with attachments; output is a directory (EISDIR); read-only dir (EACCES; skip when running as root); injected ENOSPC/partial write via an injectable fs layer — previous XML and assets byte-identical afterwards; symlinked asset dir and asset leaf; inherited symlink output leaf; XML-illegal character; validation failure writes nothing; mode preserved. `npm run test:unit` and `npm run typecheck:packages` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: new `packages/core/src/safe-fs.ts` (small shared no-follow primitives: `assertNoSymlinkAncestors(root, rel)`, `openNoFollow`, `writeExclusiveNoFollow`, `atomicReplace(target, bytes, { preserveMode, expectedIdentity, fsLayer })`, identity snapshot via `fstat`), new `packages/core/src/review-publisher.ts` (+ tests), `packages/core/src/xml-serializer.ts` (split pure serialization from writes), `packages/core/src/fs-utils.ts`, `packages/core/src/fetch-comments.ts`, `packages/core/src/index.ts`. Do not edit `src/main/*` or `packages/serve/*` (tasks 14/15 adopt the publisher) beyond keeping them compiling.
- Node `fs.constants.O_NOFOLLOW` exists on Linux/macOS (supported platforms); no Windows support needed.

## Input Dependencies
Task 3 (serializer encoding, `XmlIllegalCharacterError`, typed XML errors).

## Output Artifacts
`publishReview`, `ReviewPublishError` (consumed by tasks 14, 15, 16, 20, 21) and `safe-fs.ts` primitives (consumed by task 11 Apply and task 20 attachments).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R01/R11 and `docs/security-audit-2026-10-01.md` A5/A9, plus `xml-serializer.ts:630–790` (asset naming, `persistAttachments`, `writeAttachments`, `serializeReview`). Probes: `docs/security-audit-2026-10-01/probes.cjs` (asset symlink cases).
2. Keep asset references relative to the output directory as today. New assets get fresh unique names (e.g. `<commentId>-<random>.<ext>`), so assets referenced by the previous document are never overwritten; garbage collection of old assets is explicitly out of scope.
3. Asset bytes for attachments that already exist on disk (resumed) are handled by task 20 (relocation); here, accept attachments that carry `data` bytes and keep existing `path` references unchanged.
4. Error mapping: `EISDIR` → `output-is-directory`, `EACCES`/`EPERM`/`EROFS` → `permission-denied`, `ENOSPC`/`EDQUOT` → `no-space`, `ELOOP` (from O_NOFOLLOW) → `unsafe-link`.
5. Make the fs operations injectable (small interface with `open/write/fsync/close/rename/unlink/lstat/mkdir/realpath`) so tests can inject ENOSPC after N bytes.
6. Design `safe-fs.ts` so task 11 can reuse it for Apply's transactional write (same-directory temp file, mode preservation, identity check before rename, injectable fs layer). Keep it small and documented.
7. Concurrency: task 12 edits React Mermaid/passive files, task 13 edits `directory-scanner.ts`/`synthetic-diff.ts`/`guide-loader.ts`/resume reading. Avoid those files; re-read before editing shared ones (`index.ts`); never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration on real temp directories with fault injection. Test failure ordering and link handling; do not test Node's fs itself.
</details>
