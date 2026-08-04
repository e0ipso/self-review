---
id: 8
group: "app"
dependencies: [1, 3, 4, 5, 6]
status: "pending"
created: 2026-08-04
skills:
  - electron
  - typescript
complexity_score: 6
complexity_notes: "Wide integration surface (cli/main/IPC/exit handling), but by the plan's binding rule remote mode composes the existing git-mode pipeline after one materialization step, so the task is composition, not new pipeline logic; emitted at 6 with that explicit reason"
---
# App remote mode in the main process

## Objective
Make the GUI open a forge URL end-to-end: recognize the URL argument, materialize the
diff, run the existing git-mode pipeline against the clone at full fidelity
(expand-context and previews included), load existing forge threads like `--resume-from`
content, expose drift information to the renderer, and clean up any temporary clone on
exit.

## Skills Required
Electron main-process architecture; TypeScript.

## Acceptance Criteria
- [ ] When `CliArgs.remoteUrl` is set (from task 7's parsing), the main process:
      resolves the provider, materializes via task 5, then feeds the existing git-mode
      pipeline with the clone's repo path and the `baseSha...headSha` range — reusing
      `git-diff-loader.ts` / `git.ts` machinery, not duplicating it.
- [ ] Forge threads (providers + mapper) load into the renderer through the existing
      `resume:load` path, merged correctly when `--resume-from` is also given (resumed
      document wins; fetched threads already present in it — matched by `remote-id` —
      are not duplicated).
- [ ] Provider/CLI unavailability degrades cleanly: review opens fully, stderr notes
      thread sync unavailable, no dialog, no crash.
- [ ] Expand-context and image/SVG rendered previews work unchanged in remote mode
      because their git operations run against the materialized clone path — verified by
      unit tests asserting the expand-context and image-load IPC handlers receive the
      clone's repo path in remote mode.
- [ ] Drift: when opening with `--resume-from` a document carrying `remote-head-sha`, the
      recorded SHA is compared with the live head SHA from materialization; the
      comparison result reaches the renderer (new field on an existing payload or a
      dedicated IPC message — pick one, define it in `src/shared/types.ts` +
      `src/shared/ipc-channels.ts`); on a fresh open the recorded provenance is put into
      the review state so "Finish Review" writes `remote-*` attributes.
- [ ] Temporary clones are removed on every exit path (Finish Review, Save & Quit,
      Discard) via the existing exit-handler path in `src/main/main.ts`.
- [ ] The output `review.xml` from a remote session validates and carries
      `remote-url`/`remote-base-sha`/`remote-head-sha`/`remote-forge`; fetched threads
      keep `remote-id` and `author`; new material carries neither — proven by a unit test
      on the state assembly (serializer behavior itself is task 1's).
- [ ] Verification: `npm run test:unit` passes including new tests for the remote-mode
      orchestration seam (mocked materializer/providers).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Binding rule from the plan: after materialization, remote mode *is* git mode. Prefer
  parameterizing the existing pipeline with a repo path + range over any parallel remote
  pipeline. Audit where the main process currently assumes `process.cwd()` as the repo
  (git.ts invocations, expand-context, image loading, guide discovery) and thread the
  materialized repo path through instead.
- Guide sidecar discovery continues to work unchanged (it keys off the resolved output
  path, which stays CWD/config-based — do not move it to the temp clone).
- Config discovery (`.self-review.yaml`) stays CWD-based as today.
- IPC additions must be defined in `src/shared/ipc-channels.ts` and typed in
  `src/shared/types.ts` per convention; the renderer part is task 9 — this task only
  ships the main-side emit and the shared types so task 9 can consume them.
- The splash-screen URL entry (task 9) will need a main-side handler to start a remote
  session from a renderer-supplied URL; expose the remote-session bootstrap as a reusable
  function so both the CLI path and that handler share it, and add the IPC channel +
  handler here.

## Input Dependencies
- Task 1: types/serializer remote fields.
- Tasks 3, 4: providers. Task 5: materializer. Task 6: mapper.
- Task 7 lands in the same phase and owns `CliArgs.remoteUrl`; coordinate on that field's
  shape (it is specified in task 7's notes — treat it as the contract).

## Output Artifacts
- Remote-session bootstrap in the main process, threaded repo-path support in the
  existing pipeline, shared IPC types/channels for drift + URL-open. Consumed by task 9
  (renderer) and task 10 (docs).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `src/main/main.ts`, `src/main/git-diff-loader.ts`, `src/main/ipc-handlers.ts`
   first: find where the git diff is produced and where cwd/repo path is implied. The
   cleanest seam is usually an options object `{ repoPath }` defaulting to CWD.
2. Suggested channels: `remote:drift` (Main → Renderer, `{ recordedHeadSha, liveHeadSha }`)
   or a `drift` field on the existing `resume:load` payload — prefer the payload field if
   it avoids a new channel; and `remote:open-url` (Renderer → Main, `string`) for the
   splash field. Follow naming style in `src/shared/ipc-channels.ts`.
3. Thread merge on resume: match by `remoteId` — a fetched thread whose root `remoteId`
   already exists in the resumed document is skipped (the resumed copy may contain the
   user's added replies). Simple and deterministic.
4. Provenance into state: the remote fields recorded at materialization time flow into
   the `ReviewState` the renderer maintains, so `review:submit` returns them and the
   serializer emits them. Check how `gitDiffArgs`/source info currently flows into the
   state for the pattern.
5. Exit cleanup: `src/main/main.ts` has the exit/close handling ("Finish Review",
   three-way close dialog). Register the materializer's `cleanup` alongside whatever
   runs on all quit paths (e.g. `will-quit`).
6. Do not build any degraded mode: there is none. Failure to materialize is a fatal
   startup error with git's stderr + auth hint (from task 5), shown the way existing
   startup git errors are shown.
</details>
