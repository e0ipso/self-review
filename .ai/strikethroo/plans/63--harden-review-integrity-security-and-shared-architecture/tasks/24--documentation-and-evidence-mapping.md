---
id: 24
group: "documentation"
dependencies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
status: "completed"
created: 2026-10-01
skills:
  - technical-writing
  - markdown
complexity_score: 4
execution_profile: "docs-and-config"
---
# Update documentation for changed contracts and record the finding-to-evidence mapping

## Objective
Documentation describes the final behavior and every deliberate contract break: README (configuration/font-size, CLI flags, quit/save behavior), package READMEs (session replacement semantics, error policy), serve README (capability bootstrap, SSH forwarding, durable acknowledgement and retry), XML/XSD docs if the format changed, release documentation (trust/permission prerequisites), `docs/PRD.md` where contracts changed, and root plus affected package AGENTS.md (shared ownership, source/snapshot and write boundaries, library error policy, preview isolation, IPC table changes, corrected remote-suggestion parity claim, verification commands/fixtures). A completion evidence map links each R01–R19 / A1–A9 finding and the eight simplifications to the tests/evidence that verify it.

## Skills Required
Technical writing in Markdown.

## Acceptance Criteria
- [x] `docs/hardening-evidence-2026-10-01.md` maps each of R01–R19, A1–A9 and simplifications 1–8 to concrete tests/files/commands (or a recorded external prerequisite), without rewriting the audit documents (they stay unchanged as historical evidence).
- [x] AGENTS.md: the "File writes", "No network access", "XML must validate", "Remote PR/MR mode" (parity claim), IPC channel table, Architecture and Testing sections reflect the implementation; new modules (`review-publisher.ts`, `safe-fs.ts`, `anchor-validation.ts`, `snapshot-reader.ts`, `input-budgets.ts`, etc.) appear in the project structure; type-only/browser-only rules are retained.
- [x] Package AGENTS.md/README files for core, react and serve updated where their contracts changed; serve README no longer claims there is no authentication.
- [x] `docs/PRD.md` updated where documented contracts changed (quit/save, serve acknowledgement, Apply refusal reasons, diff format support).
- [x] `npm run format:check` passes (docs/ is prettier-ignored; README/AGENTS files may not be).
- [x] No kenkeep curation, no vendored tooling edits, no unrelated docs.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `README.md`, `AGENTS.md`, `packages/*/README.md`, `packages/*/AGENTS.md`, `docs/PRD.md`, release docs from task 1, new evidence map.
- Base claims on the actual code and the phase commits (`git log`, `git diff <base>..HEAD --stat`), not on task descriptions.

## Input Dependencies
All implementation tasks.

## Output Artifacts
Final documentation.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Use `git log --oneline` since the plan's base commit and read each task file's acceptance criteria and the phase commits to build the evidence map.
2. Keep AGENTS.md style (prose paragraphs, no em-dash overuse changes, Prettier formatting with `npx prettier --write AGENTS.md README.md packages/*/README.md packages/*/AGENTS.md`).
3. Record deliberate public API/CLI/schema breaks in a "Breaking changes" section of the evidence map and the relevant package READMEs (no migration guide required).
4. Do not commit; the orchestrator commits.

Test philosophy: not applicable (documentation-only task); verification is `npm run format:check` and accuracy against code.
</details>
