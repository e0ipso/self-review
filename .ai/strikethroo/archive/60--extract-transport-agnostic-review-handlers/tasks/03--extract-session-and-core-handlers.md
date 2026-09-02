---
id: 3
group: "extraction"
dependencies: []
status: "completed"
created: 2026-09-02
skills:
  - typescript
  - electron
complexity_score: 7
complexity_notes: "Wide blast radius across the whole main-process IPC surface, and the correctness constraint is 'observably identical', which no single assertion proves. Split from task 4 so the review-start handler's dialog interaction is handled separately."
execution_profile: "complex-architecture"
---
# Introduce the session object and extract the core handler bodies

## Objective

Create `src/main/review-handlers.ts` holding an explicit session type and the
handler bodies that currently read module-scope caches, and reduce
`src/main/ipc-handlers.ts` to registrations that construct the desktop session
and forward to them. This is Components 1 and 2 of the plan.

The `REVIEW_START_DIRECTORY` handler is deliberately **not** in this task. It is
task 4.

## Skills Required

- `typescript` — deriving a type from existing reads and moving bodies across
  module boundaries without altering them.
- `electron` — knowing which responsibilities are Electron's and must stay in
  the registration layer.

## Acceptance Criteria

- [ ] `src/main/review-handlers.ts` exists and exports a session type plus a
      factory that creates an empty session.
- [ ] The eight module-scope `let` declarations at `src/main/ipc-handlers.ts:28-35`
      are gone. `grep -n '^let ' src/main/ipc-handlers.ts` returns nothing.
- [ ] `grep -nE '^(let|var)  *' src/main/review-handlers.ts` returns nothing:
      no mutable state at module scope in the new module.
- [ ] Every extracted function takes the session as a parameter and reaches no
      state that is not reachable through it.
- [ ] `ipc-handlers.ts` still exports `setDiffData`, `setGuideData`,
      `setConfigData`, `setOutputPathInfo` and `setResumeData` with unchanged
      signatures, now writing to the desktop session. `src/main/main.ts` imports
      these and must not need editing.
- [ ] `src/main/ipc-handlers.test.ts` passes **unmodified**. If a test must
      change, the change is a signal that behaviour moved; stop and report it
      rather than editing the test to fit.
- [ ] `npm run lint` exits 0 (pre-existing `.agents/skills/**` warnings aside).
- [ ] `npm run test:unit` passes: 125 main, 213 renderer, 368 core at the time
      of writing, and no fewer after.
- [ ] `npm run test:e2e` (the browser end-to-end project) passes.

## Technical Requirements

### The session type

Derive it strictly from what the handlers read today. The eight caches are:

| Cache at `ipc-handlers.ts` | Type |
| --- | --- |
| `reviewStateCache` | `ReviewState \| null` |
| `diffDataCache` | `DiffLoadPayload \| null` |
| `guideDataCache` | `GuideLoadPayload \| null` |
| `configCache` | `AppConfig \| null` |
| `outputPathInfoCache` | `OutputPathInfo \| null` |
| `resumeCommentsCache` | `ReviewComment[]` |
| `resumeViewedFilesCache` | `string[]` |
| `resumeRemoteDriftCache` | `RemoteDriftInfo \| null` |

Do not add a field that no current handler reads. The plan calls that out as a
named risk: designing for the anticipated second front end is building for a
need that has not arrived.

### What moves

These bodies move into `review-handlers.ts`, taking the session as their first
parameter, and are called from the registrations:

- `IPC.DIFF_REQUEST` — resolving the diff payload and, when present, the guide
  that rides with it.
- `IPC.DIFF_LOAD_IMAGE` — including the remote-session branch that reads the
  blob at the reviewed head SHA through git.
- `IPC.DIFF_LOAD_FILE`
- `IPC.CONFIG_REQUEST` — resolving config and output path info together.
- `IPC.REVIEW_SUBMIT` — storing the submitted state on the session.
- `IPC.ATTACHMENT_READ` — no session state, but it is ordinary Node and belongs
  with the rest.
- `IPC.RESUME_REQUEST` — including the condition under which no payload is sent
  at all.
- `IPC.DIFF_EXPAND_CONTEXT` — including the write back to the session's diff data.
- `preparePayload`, the private large-payload helper. `sendDiffLoad` also calls
  it, so it must be exported from the new module and imported back.
- The cached-state read inside `requestReviewFromRenderer`, as a function that
  takes the state and clears it. `requestReviewFromRenderer` itself stays.

### What stays

`ipc-handlers.ts` keeps its Electron responsibilities:

- `IPC.APP_GET_INFO`, `IPC.DIALOG_PICK_DIRECTORY`, `IPC.FIND_IN_PAGE`,
  `IPC.FIND_STOP`, `IPC.VERSION_UPDATE_REQUEST`, `IPC.OPEN_EXTERNAL`.
- `sendDiffLoad`, `sendConfigLoad`, `sendResumeLoad`, `sendGuideLoad`,
  `registerFindInPageForWindow`, `requestReviewFromRenderer`.
- `IPC.REVIEW_START_DIRECTORY`, which task 4 handles.
- The `event.sender.send(...)` calls. An extracted function returns a value; it
  never touches an Electron event. That boundary is the whole point of the change.

## Input Dependencies

None. Independent of tasks 1 and 2.

## Output Artifacts

- `src/main/review-handlers.ts` — the session type, its factory, and the
  extracted bodies. Consumed by tasks 4 and 5.
- A thinner `src/main/ipc-handlers.ts`.

## Implementation Notes

<details>
<summary>Step by step</summary>

1. Read the whole of `src/main/ipc-handlers.ts` before changing anything. It is
   561 lines. Do not work from grep output alone.

2. Write the session type and its factory first, from the table above. Name the
   fields after what they hold, dropping the `Cache` suffix, since they are no
   longer caches.

3. Move one handler body at a time, running `npx vitest run --config vitest.config.main.ts`
   after each. A single failing move is easy to find; ten at once is not.

4. For each body: the extracted function returns what the handler would have
   sent, and the registration does the sending. So

   ```ts
   ipcMain.on(IPC.CONFIG_REQUEST, event => {
     if (configCache) {
       event.sender.send(IPC.CONFIG_LOAD, configCache, outputPathInfoCache);
     }
   });
   ```

   becomes an extracted function that returns the config and output path info (or
   nothing), and a registration that sends whatever it returned. Preserve the
   "send nothing at all when absent" behaviour exactly; the renderer distinguishes
   an absent message from an empty one.

5. `IPC.DIFF_REQUEST` sends two messages, the diff and then the guide, in that
   order, and only sends the guide if there is one. Whatever shape you return,
   the registration must preserve both the order and the conditionality. The
   comment in the current source explaining why the guide rides after the diff
   should travel with the code.

6. `IPC.DIFF_EXPAND_CONTEXT` mutates `diffDataCache` near the end, replacing the
   expanded file's hunks. That write becomes a write to the session. It is
   load-bearing: the expanded hunks must be visible to a later `DIFF_LOAD_FILE`
   on the same session.

7. Construct the desktop session once at module scope in `ipc-handlers.ts` and
   have the registrations and the `set*` exports use it. A single module-scope
   `const` holding the desktop application's own session is expected and correct;
   what must not exist is mutable module-scope state inside `review-handlers.ts`.

8. Keep the existing `console.error` diagnostics exactly where they are and with
   the same text. They are the only trace this code leaves, and changing them
   silently changes what a bug report shows.

</details>

<details>
<summary>Verifying it is really a move</summary>

Once done, read the diff of the extracted bodies against the originals:

```bash
git diff --find-renames -M10% src/main/ipc-handlers.ts src/main/review-handlers.ts
```

Every difference should be explainable as one of: the session parameter
replacing a cache read, a return replacing an `event.sender.send`, or an import
rewrite. Anything else is a behaviour change and must be either reverted or
called out explicitly in the task report. The plan names "a silent behaviour
change during the move" as the primary technical risk, and this diff read is the
cheapest place to catch one.

</details>
