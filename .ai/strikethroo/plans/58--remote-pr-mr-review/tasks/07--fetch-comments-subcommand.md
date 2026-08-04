---
id: 7
group: "cli"
dependencies: [1, 3, 4, 5, 6]
status: "pending"
created: 2026-08-04
skills:
  - typescript
  - electron
complexity_score: 5
---
# Headless fetch-comments subcommand

## Objective
Add subcommand routing to the CLI and implement `self-review fetch-comments <URL>`: the
first headless mode of the binary, which materializes the PR/MR, fetches and maps forge
threads, and writes a v3 `review.xml` with remote provenance and per-thread `remote-id`s —
without ever creating a window.

## Skills Required
TypeScript in the Electron main process; CLI design within Electron's argv quirks.

## Acceptance Criteria
- [ ] `src/main/cli.ts` grows explicit subcommand routing decided at the top of parsing:
      `fetch-comments <URL>` is recognized before any window creation; unknown
      subcommand-like tokens keep today's pass-through-to-git behavior for local mode.
- [ ] `parseCliArgs` unit tests cover: `fetch-comments` with a URL, `fetch-comments`
      missing its URL (error to stderr, exit 1), a bare forge URL argument (recognized as
      remote GUI mode for task 8, exposed on `CliArgs`), and unchanged behavior for
      existing local invocations (`--staged`, `--resume-from`, ranges).
- [ ] The subcommand runs fully headless: no `BrowserWindow`, quitting cleanly after the
      write; on any failure it prints the error to stderr and exits 1, cleaning up any
      temporary clone it created.
- [ ] Orchestration: parse URL (task 2) → provider base-branch lookup (tasks 3/4, falling
      back to the git-only base-branch helper from task 5 when the CLI is unavailable,
      with a stderr notice) → materialize (task 5) → fetch + map threads (tasks 3/4 + 6;
      when the forge CLI is unavailable, exit with a clear stderr error since fetching
      comments is this subcommand's entire purpose) → serialize (task 1).
- [ ] The output document carries `remote-url`, `remote-base-sha`, `remote-head-sha`,
      `remote-forge`, per-thread `remote-id`s, and validates against the amended XSD via
      the serializer's existing validation path; it honors the `output-file` config and
      the existing config discovery; all logging goes to stderr, nothing to stdout.
- [ ] The written document round-trips: loading it with the existing parser
      (`--resume-from` path) preserves `remote-id`s and remote root attributes — proven
      by a unit test exercising serialize→parse on the orchestrator's output state.
- [ ] Verification: `npx vitest run src/main/cli.test.ts` and the new orchestrator test
      pass; `npm run test:unit` stays green.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Subcommand detection must precede Electron window/app UI setup in `src/main/main.ts`;
  use `app.whenReady()` only if needed for nothing UI-bound, and call `app.quit()` /
  `process.exit` appropriately after completion. Mind packaged-vs-dev argv offsets —
  `getAppArgs()` in `cli.ts` already handles them; build on it.
- Every file marked viewed-appropriate for resume: follow the plan — the emitted
  `ReviewState` marks files so a subsequent `--resume-from` session starts sensibly
  (align with how `viewedFiles` works in the existing state; fetched threads must appear
  on their files).
- Extract the orchestration into a testable module (e.g. `src/main/fetch-comments.ts`)
  with injected provider/materializer/filesystem seams; the CLI entry stays thin.
- Reuse existing config loading (`src/main/config.ts`) for `output-file`; write with the
  same validated-write path the app uses (validate against XSD, stderr + exit 1 on
  validation failure).

## Input Dependencies
- Task 1: serializer with remote attributes.
- Tasks 3, 4: providers.
- Task 5: materializer (+ git-only base-branch helper).
- Task 6: thread mapper.

## Output Artifacts
- Subcommand routing in `src/main/cli.ts` (+ `CliArgs` remote fields consumed by task 8),
  orchestrator module + tests. The documented CLI surface for task 10.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Routing shape: extend `CliArgs` with
   `{ subcommand: 'fetch-comments' | null, remoteUrl: string | null }`. First positional
   arg `fetch-comments` → subcommand mode; else if the first positional parses via
   `parseForgeUrl` → `remoteUrl` set (GUI remote mode, task 8 consumes it); else legacy
   pass-through.
2. In `src/main/main.ts`, branch on `subcommand` before any window creation, mirroring
   how early-exit paths already work (see the welcome-screen / no-repo handling for
   precedent on pre-window decisions).
3. GitLab default: unresolved threads only (`includeResolved` not set). If a flag for
   including all is trivial to add (`--all-threads`), add it and test it; the plan names
   the option at mapper/provider level, the CLI flag is the natural exposure.
4. Provider selection: `forge === 'github'` → GitHub provider with a real child-process
   runner (following `src/main/git.ts` execution patterns), else GitLab provider.
5. Temp-clone cleanup on both success and failure paths (try/finally around
   orchestration); reuse the `cleanup` handle from the materializer.
6. Nothing to stdout — stdout stays unused per convention; `console.error` for the
   chosen-materialization-path notice and all progress/errors.
</details>
