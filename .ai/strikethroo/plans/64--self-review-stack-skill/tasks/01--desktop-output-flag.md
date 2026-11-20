---
id: 1
group: "desktop-cli"
dependencies: []
status: "pending"
created: 2026-11-20
skills:
  - electron-main-process
  - vitest
complexity_score: 4
---
# Add -o/--output to the desktop command line

## Objective
Let the desktop `self-review` command accept `-o <file>`, `--output <file>` and `--output=<file>` as the initial output path, treated as an explicit output target exactly like `self-review-serve`, so the guide sidecar is discovered next to it at startup. With no flag, behavior is unchanged.

## Skills Required
- `electron-main-process`: desktop CLI parsing and startup wiring in `src/main/`.
- `vitest`: unit tests for the parser and startup.

## Acceptance Criteria
- [ ] `parseAppArgs(['-o', 'x.xml', 'main..HEAD'])`, `parseAppArgs(['--output', 'x.xml'])` and `parseAppArgs(['--output=x.xml'])` all yield `outputPath: 'x.xml'` and leave the flag out of `gitDiffArgs`.
- [ ] `parseAppArgs(['--output='])` and `parseAppArgs(['-o'])` yield exit code 1 with an `Error: … requires a file path argument` diagnostic (from `ApplicationOptionError`).
- [ ] A git option's separate value is still git's: `parseAppArgs(['-S', '--output'])` keeps both in `gitDiffArgs` and `outputPath` stays `null`. Arguments after `--` are untouched.
- [ ] With no flag, `outputPath` is `null` and startup calls `resolveOutputTarget(null, …)` exactly as before; with the flag, startup passes the path and the resulting target has `origin: 'explicit'`.
- [ ] `fetch-comments` parsing is unchanged (`outputPath: null`).
- [ ] The flag table comment at the top of `packages/core/src/startup.ts`, the `printHelp` text in `src/main/cli.ts`, the README's desktop command-line documentation and AGENTS.md's "Shared startup" paragraph no longer say the desktop has no `--output`; they describe `-o`/`--output` as the initial output path the save dialog can still change.
- [ ] `npm run test:unit:main -- --run` (or `npx vitest run --config vitest.config.main.ts`) passes, and `npm run typecheck` and `npm run typecheck:unit` exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `src/main/cli-parser.ts`: `VALUE_FLAGS` currently is `{ '--resume-from': 'resumeFrom' }`; add `'--output': 'outputPath'` and `'-o': 'outputPath'`, mirroring `packages/serve/src/args.ts`. Extend `CliArgs` (defined near the top of `cli-parser.ts` or its types) with `outputPath: string | null`, and set it in every `result(...)` return (including the `fetch-comments` and error branches, as `null`).
- `src/main/startup-operations.ts` `prepare()`: replace `resolveOutputTarget(null, loadedConfig, cwd)` with `resolveOutputTarget(cli.outputPath, loadedConfig, cwd)`. `resolveOutputTarget` (`packages/core/src/startup.ts`) already returns `{ origin: 'explicit' }` for a non-null path.
- Guide discovery already derives from the startup output target; verify by reading how `loadGuide` gets its path in `src/main/startup-operations.ts` / `packages/core/src/guide-loader.ts`, and do not add a second discovery path.
- Keep `parseEarlyExit` working (it shares `VALUE_FLAGS`).
- Do not change serve, `fetch-comments`, or the refusal of a project-configured `--output` in `default-diff-args` (`ConfiguredDiffArgsError`).

## Input Dependencies
None. Baseline is upstream `6b33509`.

## Output Artifacts
- Desktop launch shape usable by the stack skill: `self-review -o <outdir>/<slug>.review.xml <diff args>`.
- Updated docs: README desktop CLI section, AGENTS.md "Shared startup", `startup.ts` flag table, `cli.ts` help.

## Implementation Notes
<details>
<summary>Guidance</summary>

- Read `src/main/cli-parser.ts` fully, then `src/main/cli-parser.test.ts` and `src/main/cli.test.ts` for test style; add cases there (colocated tests).
- Search for every construction of a `CliArgs` value (`grep -rn "resumeFrom:" src/main`) so the new field is set everywhere, including test fixtures that build `CliArgs` literals and `startup*.test.ts` mocks of `parseCliArgs`.
- Add a test in the existing startup tests (`src/main/startup.test.ts` or `startup.supplied.test.ts`, whichever mocks `parseCliArgs`/`prepare`) asserting the explicit output target when `outputPath` is set and the inherited/config default when it is `null`.
- In `printHelp`, add a line under Options such as `--output, -o <file>     Initial review output path (the save dialog can still change it)`, add one example (`self-review -o /tmp/step.review.xml main..feature`), and update the sentence "All arguments except --resume-from and --help are passed to git diff" to include `--output`/`-o`. Update the final paragraph to mention `-o` alongside the configured `output-file`.
- In `packages/core/src/startup.ts`, edit only the comment table row for `--output` (desktop column: "yes (initial path; the save dialog can change it)") and the sentence "The command lines differ on purpose…" so it stays accurate.
- README: find the desktop CLI usage and "Available options" area (`grep -n "resume-from" README.md`) and document `-o`/`--output` next to `--resume-from`. Keep the tone of surrounding text.
- AGENTS.md: in the "Shared startup" paragraph, replace "the desktop has no `--output` (the save dialog changes the path)" with a statement that both take `-o`/`--output` (desktop: initial path, the save dialog can change it). Search AGENTS.md for any other "no `--output`" statement and fix it.
- Run `npx prettier --write` on touched non-ignored files (or rely on lint-staged), then `npm run lint`.
- Commit with a Conventional Commits message, e.g. `feat(desktop): accept -o/--output as the initial output path`, no AI trailers.
</details>
