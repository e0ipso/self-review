---
id: 21
group: "startup"
dependencies: [10, 14, 19]
status: "completed"
created: 2026-10-01
skills:
  - typescript-refactoring
  - secure-coding
complexity_score: 7
complexity_notes: "Shares startup primitives between two front ends and adds configuration provenance that gates write-capable Git options and inherited output paths."
execution_profile: "complex-architecture"
---
# Reuse startup primitives across desktop and serve and track configuration provenance (R15, A5)

## Objective
Desktop and serve tokenize, format, classify and resolve startup input with the same core primitives: structured argv preserved end to end, `--` respected, option values never mistaken for source paths/forge URLs/subcommands, consistent equals-form flags where the transport intent is the same. Configuration loading records the origin (CLI / user config / project config / default) of `default-diff-args` and `output-file`; project-supplied diff args cannot contain write-capable Git options, and inherited output paths go through the publisher's `inherited` policy.

## Skills Required
TypeScript refactoring across CLI front ends and secure-coding for configuration trust levels.

## Acceptance Criteria
- [x] Serve (`packages/serve/src/startup.ts:57,62–83,110`) uses core's tokenize/format/classify helpers instead of splitting configured args on spaces and joining argv without quoting; configured `-S "a b"` and a CLI search value containing spaces work in serve startup, expansion (task 19) and XML metadata roundtrip.
- [x] Source path selection in both front ends (`src/main/main.ts:241,254`, serve startup) uses the classifier's positional indices; `self-review -S src/x.ts` (option value) is not treated as a file/directory source; `--` ends option parsing in both CLIs; a forge URL or `fetch-comments` appearing as an option value is not routed as remote/subcommand.
- [x] Equals-form application flags (`--output=path`, `--resume-from=path`) are accepted by both parsers where both support the flag; intentional CLI differences are listed in a comment/table in one place.
- [x] Shared config/guide/resume/load-mode primitives that are duplicated between `src/main/main.ts` and `packages/serve/src/startup.ts` move to core (`packages/core/src/startup-mode.ts` or similar) and are used by both; dialogs and lifecycle stay host-specific. No generic startup framework.
- [x] `packages/core/src/config.ts` (`:97,:177,:199`) returns values with provenance; `default-diff-args` from project config are validated by `git-diff-args.ts` and write-capable/external-execution options (`--output`, `--output=*`, `--ext-diff`, `--textconv`, `-o`? — verify Git's diff options list) are rejected with a visible error before any Git command runs. Probe regression: committed `.self-review.yaml` with `default-diff-args: --output=../sentinel` leaves the sentinel unchanged and reports an error.
- [x] Output path provenance flows to `publishReview`: CLI `--output`/dialog choice → `explicit`; project config or default `review.xml` → `inherited` (symlinked default `review.xml` committed in the repo is refused, not followed). Both hosts pass it.
- [x] Equivalent argument cases are tested through both front ends (table-driven: spaced search value, option value that looks like a path/URL, `--`, equals-form flags, project config default args). `npm run test:unit`, `npm run typecheck`, `npm run typecheck:packages`, `npm run test:e2e:serve` and `npm run test:e2e:electron` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `src/main/cli.ts`, `src/main/cli-dispatch.ts`, `src/main/main.ts` (startup section), `packages/serve/src/args.ts`, `packages/serve/src/startup.ts`, `packages/core/src/config.ts`, `packages/core/src/git-diff-args.ts`, `packages/core/src/startup-mode.ts`, `packages/core/src/index.ts`, tests.
- Keep project filtering behavior (ignore patterns) unchanged; no new filtering UI.

## Input Dependencies
Task 10 (publisher output policy), task 14 (desktop save path in `main.ts`), task 19 (structured argv used by expansion; `git-diff-args.ts` changes).

## Output Artifacts
Shared startup primitives and config provenance (task 22 adjusts remote startup lifetime in the same `main.ts`; task 23 consolidates config defaults).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R15, `docs/security-audit-2026-10-01.md` A5, `docs/security-audit-2026-10-01-sol/sol-p4-config.md`, `docs/security-audit-2026-10-01-sol/claude-probe-config.ts`.
2. Explicit reviewer CLI arguments are trusted (the user typed them); only project-supplied args are restricted. Still, `--output` passed explicitly to git via the CLI would clobber files — the plan only requires rejecting write-capable options from inherited configuration; keep explicit CLI args unrestricted except unsupported formats (task 4).
3. Concurrency: this phase runs alone. Re-read files before editing; never revert unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (parse real argv through both front ends' startup functions; real temp repos for config probes). Test edge cases; skip trivial code.
</details>
