---
id: 20
group: "output-publication"
dependencies: [10, 13, 18]
status: "completed"
created: 2026-10-01
skills:
  - nodejs-filesystem
  - typescript
complexity_score: 6
complexity_notes: "Attachment origin tracking across resume, read authorization, and relocation through the publisher in both hosts."
execution_profile: "standard-implementation"
---
# Make attachments follow the resumed document and restrict attachment reads (R11 core, attachment hardening)

## Objective
Imported attachments resolve relative to the resumed XML document (not CWD or the new output directory); attachment reads are restricted to that authorized asset origin (or the current output's asset directory), to regular files, and to bounded sizes; saving to a different output directory copies referenced attachment bytes into the new `.self-review-assets/` through the publisher so published references resolve to the correct bytes.

## Skills Required
Node.js filesystem and TypeScript.

## Acceptance Criteria
- [x] Resume import records each attachment's origin (absolute path resolved against the resume document's directory) in session state (not in the XML); the renderer continues to see the relative reference.
- [x] `readAttachment` (`review-handlers.ts:386`) takes the session and an attachment reference, authorizes it against the recorded origins/current asset dir, opens with no-follow (`safe-fs.ts`), requires a regular file, and enforces the per-attachment byte budget from `input-budgets.ts` (reuse the 10 MB image limit if that is the existing constant). Arbitrary paths (e.g. `/etc/passwd`, outside sentinel) are refused. Desktop IPC and serve's attachment route both use it (serve currently contains reads under the output asset root — replace with the shared function).
- [x] On publication to an output directory different from the attachment's origin, the publisher input includes the bytes (loaded via the authorized reader) so `publishReview` stages them as new assets; references in the published XML resolve to the correct bytes. Unchanged-location saves keep existing references.
- [x] Tests: resume a review with attachments from a different CWD → images load; save into a new output directory → assets copied and references resolve; outside/arbitrary paths refused; FIFO/symlink/oversize refused. `npm run test:unit` passes; Electron resume e2e still passes (`npm run test:e2e:electron`).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/core/src/review-handlers.ts` (`readAttachment`, resume load), `packages/core/src/xml-parser.ts` (only if origin must be captured during parse), `packages/core/src/review-publisher.ts` (relocation input), `src/main/ipc-handlers.ts` (attachment read handler), `packages/serve/src/server.ts` (attachment route), `packages/types/src/index.ts` if a type changes.

## Input Dependencies
Task 10 (publisher, `safe-fs.ts`), task 13 (`input-budgets.ts`), task 18 (session source identity).

## Output Artifacts
Origin-aware attachment handling.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R11 and `docs/security-audit-2026-10-01.md` A9 + "Restrict automatic reads". Locations: `review-handlers.ts:386`, `xml-serializer.ts:690–755`, `serve/server.ts:303–307`.
2. Do not add an asset garbage collector.
3. Concurrency: task 19 edits `expandContext` in `review-handlers.ts` in the same phase; keep to attachment/resume functions, re-read before every edit; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration on real temp directories. Test origin/relocation/authorization; skip trivial helpers.
</details>
