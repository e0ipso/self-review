---
id: 5
group: "helper"
dependencies: [4]
status: "completed"
created: 2026-11-20
skills:
  - typescript
complexity_score: 4
---
# Implement the helper's check-imports and table subcommands

## Objective
Port `stack.py`'s `check-imports` (optional JS/TS heuristic) and `table` (Markdown summary) subcommands, dropping the "Loaded N files" comparison that existed only for the untracked-file workaround.

## Skills Required
- `typescript`: port of regex-based import analysis and table rendering.

## Acceptance Criteria
- [x] `node stack.cjs check-imports <spec> [--alias PREFIX=DIR]... [--ignore REGEX]...` reports, per step branch, imports of files that do not exist at that step and named imports a changed file does not yet export at that step; prints `N problem(s)` and exits 1 when N > 0, else 0.
- [x] `node stack.cjs table <spec>` prints `| # | Step | Description | Diff | Review URL |` rows per step with shortstat per step and a bold Total row; the URL column is the last `Review ready at <url>` in `<spec dir>/<slug>.serve.log`, `completed (\`<slug>.review.xml\`)` when that review exists, `not ready, see log` when the log has no URL, and `not started` when there is no log. Pipe characters in descriptions are escaped.
- [x] No "Loaded N files" parsing or warning remains.
- [x] Integration tests run the bundle against a fixture repo with a built stack (reuse task 4's fixture helpers) and cover: an ordering problem detected by `check-imports` (step 1 imports a name step 2 adds) and a clean stack reporting `0 problem(s)`; `table` output for the four URL states.
- [x] Bundle rebuilt and committed; `npm run test:unit --workspace @self-review/skill-scripts` and `npm run typecheck:packages` exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Port `SOURCE`, `FROM`, `BARE`, `DECLARED`, `LISTED`, `STAR`, `CANDIDATES`, `braced_names`, `exported_names`, `resolve_import`, `cmd_check_imports`, `serve_status`, `cmd_table` from `stack.py` (location in task 4's Technical Requirements). Keep the Svelte/Vue file extensions as heuristics; they are part of the JS/TS check, not project assumptions.
- `--alias` and `--ignore` are repeatable; reject a malformed `--alias` without `=`.
- Reuse task 4's `git`, spec loading, `branch`, `stackBase`, `shortstat`, `diffstat` helpers; do not duplicate them.

## Input Dependencies
- Task 4: shared helpers, `build` (to create fixture stacks), test fixture utilities.

## Output Artifacts
- Complete helper with all four subcommands in source and in the committed `stack.cjs`.

## Implementation Notes
<details>
<summary>Guidance</summary>

- Files: `src/stack/check-imports.ts`, `src/stack/table.ts`, wired in `src/stack/cli.ts`. Argument parsing for `check-imports` can be a small hand-written loop (no new dependency).
- Python `re.findall` with groups returns tuples; with JS use `matchAll` and pick the same groups. Watch the `FROM` regex's backreference `\2` and the multiline behavior (Python's `re` default is not multiline; keep JS without the `m` flag unless `^`/`$` anchoring needs it).
- `serve_status`: check `<slug>.review.xml` existence first, as in Python.
- Tests: add to the existing process test file or a sibling `stack-report.process.test.ts`; write fake `.serve.log` files by hand for the table states. Keep to a few integration tests.
- Test philosophy for this plan: write a few tests, mostly integration. Test custom logic, critical workflows, edge cases and error conditions in core functionality, and integration points; do not test third-party library behavior, trivial getters or static configuration.
- Rebuild the bundle before testing; commit source, tests and bundle together.
- Commit: `feat(skill-scripts): port stack check-imports and table`, no AI trailers.
</details>
