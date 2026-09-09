---
id: 4
group: "serve-mode-node-cli-package"
dependencies: [3]
status: "completed"
created: 2026-09-09
skills:
  - nodejs
  - typescript
complexity_score: 5
execution_profile: "standard-implementation"
---
# Startup, arguments and lifecycle

## Objective
Resolve one review session at startup the same way the desktop application does,
serve it, and stop the process when the review completes.

## Skills Required
`nodejs` for the executable and process lifecycle; `typescript` for the startup
logic.

## Acceptance Criteria
- [ ] The executable accepts git diff arguments and an output path, resolving its session with `determineMode` from `@self-review/core` — the same function the desktop uses.
- [ ] The output path is fixed by a startup argument. There is no route, and no adapter method, that changes it.
- [ ] Submitting a review writes the output file and then stops the server, and the process exits 0.
- [ ] Closing the browser tab does nothing: no write, no exit, no auto-save.
- [ ] The program prints the URL to stderr on start. Nothing is written to stdout.
- [ ] `grep -rn "detached\|setInterval.*process\|process.ppid" packages/serve/src` returns nothing — no watchdog, no re-exec, no detached spawning.
- [ ] Running the built executable against a real repository serves a diff and exits after a review is submitted.
- [ ] `packages/serve/package.json` declares `"prebuild": "npm run build --workspace @self-review/core"`, so `npm run build --workspace @self-review/serve` builds its dependency first. Without it the executable fails with `ERR_MODULE_NOT_FOUND`: `@self-review/core` resolves to `dist/`, which is gitignored and which no root script builds. This affects the workspace only — the published tarball carries `dist` because the release job builds before publishing.
- [ ] `session.guideData` is populated before the listener opens. `GET /api/diff` returns whatever `getDiffLoad` finds there; the desktop sets it during startup and this program must too, or every response carries a null guide.
- [ ] The `repositoryRoot` passed to the server factory is the diff's `source.repository`. `loadImage` and `expandContext` resolve against the session's repository, so path containment is only a real guarantee when both agree.

## Technical Requirements
Process lifetime is review lifetime. This mirrors the desktop application's
discard-on-quit behaviour rather than inventing a session model.

Four things are deliberately excluded and are success criteria of the plan: no
re-exec with a platform switch, no parent-process watchdog, no packaged-build
asset-resolution branch, and no detached spawning. They belong to the discarded
design where this ran inside the desktop binary. If one seems necessary, that is
evidence the program is running somewhere it should not be.

`stdout` is unused across this project — the desktop app writes all logging to
stderr so its XML output is never polluted. Hold to it here.

## Input Dependencies
Task 3's server factory, which this task starts.

## Output Artifacts
The working executable: `packages/serve/src/cli.ts` plus its startup module.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Replace the placeholder `packages/serve/src/cli.ts` from task 1 with the real entry point.
2. Parse arguments: git diff arguments pass through, and the output path comes from an explicit flag. `normalizeGitDiffArgs` is exported from `@self-review/core` and does the `--` insertion the desktop relies on; use it rather than reimplementing.
3. Resolve the session: call `determineMode`, then build the payload the way the desktop's startup path does, then `createReviewSession`. Read `src/main/main.ts` for the desktop's ordering — but do not import from `src/`; everything needed is exported from `core`.
4. Start task 3's server on an ephemeral port bound to `127.0.0.1`, and print the resulting URL to stderr.
5. Wire completion: when `POST /api/review` succeeds and the output file is written, close the server and exit 0. The write already happens inside `submitReviewState`; this task owns only the shutdown that follows it.
6. Do not add a signal-based watchdog, a heartbeat, or any parent-process check. A closed tab is not an event this program observes.
7. Verify by hand against a real repository: run the built executable, open the URL, confirm the diff renders, submit a review, and confirm the output file exists and the process exited 0.

The startup ordering is the part worth care. If the session is resolved after the
listener opens, an early request races an unbuilt session.
</details>
