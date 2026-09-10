---
name: sift-drain
description: Use when the user asks to drain or resume a `.ai/sift` backlog end to end. Coordinate related ticket sittings, land their work, and close each wave with tests and lint.
---

# Drain Sift

Work the backlog wave by wave. Assign related tickets to worker sittings, land their
commits and tracker updates, and complete each wave gate before continuing.

## Gate: is sift initialized?

Run `sift-init`'s `scripts/sift-gate.sh` first. Use its resolved root and exit code:

- **0 (`READY`)**. Continue below.
- **3 (`UNINITIALIZED`)**. Hand off to `sift-init`; initialize without asking.
- **4 (`UNINITIALIZED`)**. Hand off to `sift-init`; report the resolved path and ask
  before initialization.
- **6 (`INCOMPLETE`)**. Hand off to `sift-init`; repair without asking.
- **5 (`UNRESOLVED`)**. No project root found. Report the `$PWD` it walked from and stop.

`tests/static/gate-handoff-contract.test.sh` checks these handoffs.

```text
@PIN: src/skills/sift-init/scripts/sift-gate.sh emit "state=READY"
@PIN: src/skills/sift-init/scripts/sift-gate.sh emit "state=UNINITIALIZED"
@PIN: src/skills/sift-init/scripts/sift-gate.sh emit "state=INCOMPLETE"
@PIN: src/skills/sift-init/scripts/sift-gate.sh emit "state=UNRESOLVED"
```

## Orchestrate, never implement

Workers implement product code and tests. You prepare their workspaces, land commits,
archive tickets and assign follow-up waves. Delegate merge conflicts too.

Read the current wave's tickets once, then refresh only changed tickets as described in
run-management.md. Read worker reports and archived resolution lines needed for gate
coverage. Derive write scope from ticket citations. Send source, diff and raw test-output
questions to workers.

Load reference sections only when their stage begins; retain already-read sections while
their content remains available and unchanged. Use `read-context.sh FILE '## Heading' PAGE`
for bounded reads (`--all` for a ticket). Follow its `next` page until `none`; an incomplete
read is not intake. Keep aggregate tool output below the harness limit, normally one 8000-byte
content page per call. Save large inventories and raw verification output to temporary files.

Never push or write to an external tracker. Reserve an ID and file upstream proposals
locally as `type: dx` for the user.

## Scripts

Resolve this skill's `scripts/` directory once. Call its helpers rather than reimplementing
them. Tracker helpers use the nearest ancestor `.ai/sift` and its configured prefix;
`SIFT_ROOT` and `SIFT_PREFIX` override them.

```sh
scripts/wave-status.sh
scripts/ticket-snapshot.sh      # redirect to a temporary file
scripts/ticket-snapshot.sh changes BEFORE AFTER  # delta TSV; redirect, then page if large
scripts/read-context.sh FILE HEADING_OR_--all [PAGE]
scripts/next-ticket.sh --group   # optional cluster hint for planning a sitting
scripts/ticket-check.sh
scripts/reserve-ids.sh <count>
scripts/prepare-worktree.sh <base> <branch> <absolute-new-path>
scripts/drain-log.sh dispatch <TICKET>...
scripts/drain-log.sh return <TICKET> <STATUS>...
scripts/drain-log.sh report
```

Pass all tickets in a sitting to one dispatch or return call so they share a timestamp.
Workers stamp their own phases. `drain-log.sh` alone writes `RUNLOG.md`.
Use `find` and `command grep`, or no-ignore search, inside the usually ignored tracker.

## Wave graph

A sitting contains related tickets from one wave. Use several sittings when orientation
or write scope differs. At intake, read the Ticket intake and The tree moves underneath you
sections of [run-management.md](references/run-management.md). Load Worker check-back only
on a check-back and Reporting to the user when reporting.

Repeat until no dispatchable work remains in this wave:

1. Before every dispatch, run `wave-status.sh` and compare ticket snapshots. Read added or
   changed current-wave tickets; reconcile moves, removals and changed dependencies. Reuse
   unchanged ticket context. Rebuild dependencies and write ownership from the reconciled
   snapshot, retaining in-flight owners. On first load, a new wave or
   lost context, read that wave's remaining tickets in full. Dependencies and overlapping
   write scopes create sequential edges. Fill available slots with ready, non-overlapping
   sittings.
2. Prepare each branch and worktree using `prepare-worktree.sh` from the original
   repository. Pass the prepared worktree as `PROJECT_ROOT`, its branch, and the original
   project root as `SIFT_ROOT`. Keep the integration checkout for landings. Workers use
   absolute shared tracker paths; do not replace their `.ai/sift` with a symlink.
3. Stamp `drain-log.sh dispatch` immediately before dispatch. For a fresh worker, load the
   placeholder preamble and Template section of [ticket-agent-prompt.md](references/ticket-agent-prompt.md)
   and send the fixed contract first, verbatim, followed by its resolved Assignment block.
   Keep assignment values at the end; prepend no ticket summary or coordinator history. For a related sitting
   in a retained worker context, load Reuse a worker and send only the new inputs. Load
   recovery sections only for the corresponding failure or check-back. If the contract
   changed or prior context is unavailable, supply the full current contract again.
4. Choose the worker's model tier and reasoning effort from the work, not from the ticket's
   `effort` field, which measures size. Use the session's tier by default. Use a stronger
   tier and higher reasoning effort for difficult architecture, concurrency or verification.
   Bounded documentation or metadata tasks may use a cheaper tier with lower reasoning
   effort, explicit inputs and checks. Apply reasoning effort only where the harness exposes
   it. Honor user preferences.
5. On return, handle tamper first, then record each ticket's reported status with
   `drain-log.sh return`. For each done ticket, cherry-pick its commit with `-n`, set
   status, resolution and updated, then move it to the mirrored archive path and delete the
   folders the move emptied. Land one commit per ticket containing implementation and
   tracker changes where tracked.
6. Assign every filed follow-up to this or a later wave. Run `ticket-check.sh` after your
   bookkeeping and fix any findings. Report one progress line per ticket and surface every
   self-filed ID. Rewire the graph and dispatch newly ready sittings.

**Failure policy:** retry only failed tickets once with their failure context. After a
second failure, set status blocked, keep the file under open with its wave, report it,
and continue. Preserve completed tickets from a partially successful sitting.

## Consume worker reports

[ticket-agent-prompt.md](references/ticket-agent-prompt.md) owns the exact report schema.
Validate reports before changing tracker state; ask the same worker for missing fields.
Its status and commit control landing, resolution supplies archive text and waived
coverage, and verification supports the progress update. Reserve IDs and file any
unfiled findings from issues before dispatching work that needs them.

## Wave gate

Do not load [wave-gate.md](references/wave-gate.md) during intake or implementation.
At each gate stage, read only its numbered section and send that stage's resolved fence.
Load section 3 only for failures and section 4 only when capture is warranted. Load section 5
at close. The order and skip conditions are below; other stage prompts can stay unread.
Prepare gate worktrees and branches as for implementation workers. Workers from the
wave do not continue into the gate or the next wave.

1. Dispatch the e2e specialist first and alone when an e2e layer can reach this wave's
   behavior. Otherwise record the skip reason. A skipped authoring pass does not remove
   the full e2e run when that layer exists.
2. Build batch coverage input from waived archived resolutions and deferred unsafe
   sequences. Dispatch the coverage agent next; it may also carry the full-suite close.
3. Land returned commits, then verify the integrated state with the full test, lint,
   static-analysis and applicable e2e suites. Keep raw logs on disk. Report commands,
   exit codes, available counts, failures and absolute log paths, or no-e2e-layer status.
4. Group failures by root cause. Reserve IDs and file reported defects before dispatching
   their fixes. Land fix commits and repeat every full run after the last fix.
5. Work any remaining p1/p2 tickets filed into this wave before closing. Tickets inserted
   into an already closed wave become the current wave's tail; their deferred coverage
   belongs to the next gate. Do not reopen a closed gate.
6. When green, dispatch one knowledge-capture pass if reports contain durable candidates
   and the project has a capture skill. Land its commit and post the wave summary.

Continue into the next wave without a human pause.

## Final report at run end

Report wave state, blocked tickets and reasons, all filed tickets, and the timing table
from `drain-log.sh report`.

## Contract pins

`tests/static/skill-prose-pins.test.sh` checks these external references.

```text
@PIN: src/skills/sift-drain/ name: sift-drain
@PIN: src/skills/sift-drain/references/ticket-agent-prompt.md The four phase commands in this contract are the only phase stamps for the sitting.
@PIN: src/skills/sift-drain/references/run-management.md ### Write scope is an edge, not a hope
@PIN: src/skills/sift-drain/references/ticket-agent-prompt.md Step 6: Return one final report
@PIN: src/skills/sift-drain/references/ticket-agent-prompt.md resolution: <TICKET-ID>: <one line, including waivers>
@PIN: src/skills/sift-drain/references/ticket-agent-prompt.md # Canonical sub-agent prompt for one worker sitting
@PIN: src/skills/sift-drain/references/wave-gate.md You are the e2e specialist closing Wave {{WAVE}} of the sift roadmap in {{PROJECT_ROOT}}.
@PIN: src/skills/sift-drain/references/wave-gate.md You are the batch coverage agent closing Wave {{WAVE}} of the sift roadmap in
@PIN: src/skills/sift-drain/references/wave-gate.md Fix one root cause of Wave {{WAVE}} gate fallout in {{PROJECT_ROOT}}.
@PIN: src/skills/sift-drain/references/wave-gate.md You are the knowledge-capture pass closing Wave {{WAVE}} of the sift roadmap in
@PIN: src/skills/sift-drain/references/run-management.md ## Ticket intake
@PIN: src/skills/sift-drain/references/run-management.md ## Worker check-back
@PIN: src/skills/sift-drain/references/run-management.md ## Reporting to the user
```
