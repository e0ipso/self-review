---
id: 4
group: "extraction"
dependencies: [3]
status: "completed"
created: 2026-09-02
skills:
  - typescript
  - electron
complexity_score: 6
complexity_notes: "The one handler where session logic and a native modal dialog are interleaved, so the split point has to be chosen rather than mechanically applied."
execution_profile: "complex-architecture"
---
# Extract the review-start handler, leaving its native dialog behind

## Objective

Move the `IPC.REVIEW_START_DIRECTORY` body into `src/main/review-handlers.ts`,
separating the part that scans a path and updates the session from the part that
shows a native warning dialog. The dialog stays in the registration layer; the
scanning and the session update do not.

## Skills Required

- `typescript` — restructuring a long handler into a session function plus a
  registration wrapper.
- `electron` — `dialog.showMessageBoxSync` is synchronous, modal and parented to
  a window, none of which can move out of the Electron layer.

## Acceptance Criteria

- [ ] The scanning and session-update logic lives in `review-handlers.ts` and
      takes the session as a parameter.
- [ ] `dialog.showMessageBoxSync`, `BrowserWindow.fromWebContents` and
      `webContents.send` appear only in `ipc-handlers.ts`, never in
      `review-handlers.ts`. Verify:
      `grep -nE 'dialog\.|BrowserWindow|webContents' src/main/review-handlers.ts`
      returns nothing.
- [ ] The large-payload decision is still made from `computePayloadStats`, and
      the caller can still cancel. Cancelling still leaves the session unchanged
      and sends nothing to the renderer.
- [ ] Choosing Continue still sets `isLargePayload` on the payload before it is
      stored and sent.
- [ ] Both branches are preserved and behave as before: a path that stats as a
      file uses `scanFile` with a `file` source; anything else uses
      `scanDirectory` with the configured ignore patterns and a `directory`
      source. A path that cannot be stat-ed is still treated as a directory.
- [ ] `npm run test:unit` and `npm run test:e2e` pass.
- [ ] `npm run lint` exits 0 apart from the pre-existing `.agents/skills/**`
      warnings.

## Technical Requirements

- The handler begins at `src/main/ipc-handlers.ts:348` and runs to the end of
  `registerIpcHandlers`. It contains the same large-payload guard twice, once
  per branch, differing only in the log message.
- The guard needs three things from the session function: the payload, the
  computed stats, and whether the stats exceed a threshold. Choose a split where
  the session function produces the payload and the stats, and the registration
  decides what to do about them. Do not invent a callback-based dialog abstraction
  to keep the whole thing in one function; a returned value the caller acts on is
  simpler and is what the rest of task 3 already established.
- The duplicated guard may be collapsed into one path if that falls out of the
  split naturally. Do not restructure the two branches beyond that.

## Input Dependencies

- Task 3: `review-handlers.ts`, the session type, and the convention that an
  extracted function returns a value rather than sending an Electron message.

## Output Artifacts

- The review-start logic in `review-handlers.ts`.
- `registerIpcHandlers` reduced to registrations only.

## Implementation Notes

<details>
<summary>Step by step</summary>

1. Read the handler in full first:

   ```bash
   sed -n '348,460p' src/main/ipc-handlers.ts
   ```

2. Note that the cancel path `return`s out of the handler without touching the
   cache and without sending anything. That is observable behaviour: the user
   clicks Cancel and the review they were looking at is still there. Preserve it.

3. A workable split is a session function that takes the session and the path,
   does the stat, scans, builds the payload, computes the stats against the
   session's config, and returns the payload plus a flag for whether the
   thresholds were exceeded, **without** storing it. The registration then
   shows the dialog when the flag is set, returns early on Cancel, marks the
   payload large on Continue, and only then commits it to the session and sends
   it. Storing only after the user has decided is what keeps the cancel path
   correct.

4. `configCache` is read in three places here: the two large-payload guards and
   the `ignorePatterns` lookup, which is `configCache?.ignore ?? []`. All three
   become reads of the session's config. Note that the guard is skipped entirely
   when there is no config, and that the dialog is skipped when there is no
   window. Preserve both.

5. Keep the two `console.error` messages distinct, as they are today. They are
   how you tell a cancelled file review from a cancelled directory review in a
   log.

6. As in task 3, read the diff at the end and confirm every difference is
   explainable as the session parameter, the returned value, or an import.

</details>
