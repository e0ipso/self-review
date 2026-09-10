# Running the drain

Use this guidance for decisions within `SKILL.md`'s orchestration loop. The worker contract
and report schema live in `ticket-agent-prompt.md`. Fresh handoffs keep its fixed contract
first and all changing values in the trailing named Assignment fields. Retained handoffs
append only a complete new Assignment block; preserve its field order and contract wording.

Pins: `tests/static/skill-prose-pins.test.sh`.

```text
@PIN: src/skills/sift-drain/SKILL.md ## Wave graph
@PIN: src/skills/sift-drain/SKILL.md ## Consume worker reports
@PIN: src/skills/sift-drain/SKILL.md ## Wave gate
@PIN: src/skills/sift-drain/references/ticket-agent-prompt.md This file is the sole full worker contract.
```

## Ticket intake

Prioritize ready tickets. Pull new p1 work forward immediately, especially broken test
infrastructure. Put p2 crash and data-integrity fixes ahead of p3/p4 work. Dependencies and
write-scope edges still take precedence.

Check integration history and branch names for prior work on proposed tickets. Pass the
checked base commit and matches, including an explicit no-match result, to the worker for
live verification; status alone cannot establish whether work is missing.

### Write scope is an edge, not a hope

Map ticket citations to files. Sequence sittings that touch the same product file; dispatch
the later one after the earlier commit lands. Add `depends_on` edges. Treat directories,
generated assets and shared templates as overlapping until tickets narrow their scope.

Use `cluster` for shared orientation, never as proof of disjoint writes or permission to
bypass priority. Consult `next-ticket.sh --group` for cluster membership and size bounds.
Assign wave-less tickets a wave before dispatch. Every sitting stays within one live wave
and starts only after its incoming edges clear.

Include documentation made inaccurate by a ticket's change in that ticket's scope and
commit. For separate follow-ups, reuse a worker with relevant context or batch small
maintenance items, subject to priority and dependencies.

Prepare branches and worktrees centrally with `prepare-worktree.sh`. Pass the worktree and
shared `SIFT_ROOT` to workers. On reuse, wait for the worker to stop, land completed work,
then prepare a new branch/worktree from current integration state for its next assignment.
Keep the old worktree if it holds unfinished work. Never reset or clean a tree holding live
tickets. Workers never check out the integration branch.

## The tree moves underneath you

Users and parallel sessions can change ignored tracker files without git history. Keep a
disposable ticket snapshot outside the tracker. `ticket-snapshot.sh` prints sorted `cksum`
records with absolute paths for both buckets; it never writes tracker state. Its `changes`
command returns only changed IDs as TSV: event, ID, old path, new path. Events are `added`,
`changed`, `moved`, `moved+changed` and `deleted`. A hyphen represents an absent path.
Identical snapshots return no records. Duplicate IDs or malformed input fail the comparison.

```sh
# Once per drain session; SCRIPTS_DIR is the resolved drain scripts directory.
SIFT_REFRESH_DIR=$(mktemp -d) &&
  : > "$SIFT_REFRESH_DIR/previous"

# Before each dispatch, alongside wave-status.sh:
"$SCRIPTS_DIR/ticket-snapshot.sh" > "$SIFT_REFRESH_DIR/current" &&
  "$SCRIPTS_DIR/ticket-snapshot.sh" changes "$SIFT_REFRESH_DIR/previous" \
    "$SIFT_REFRESH_DIR/current" > "$SIFT_REFRESH_DIR/changes"
# Page changes and relevant ticket bodies with read-context.sh; never cat a whole wave.
```

Stop on setup, scan or comparison errors and discard partial output. On first load, read
every remaining current-wave ticket, one bounded page at a time. Thereafter read only added
or content-changed tickets in that wave and changed dependency targets needed by its graph.
A pure move updates the path without rereading unchanged content. A deleted or archived
ticket leaves pending work; do not silently release its in-flight worker ownership. Resolve
that assignment before a conflicting dispatch. Later-wave changes need no body read until
they affect this wave. A wave change requires loading that wave even when its files are
unchanged relative to the previous snapshot.

Retain each read ticket's ID, path, priority/status/wave, dependencies, cited write scope
and fingerprint. Rebuild the graph from all retained records reconciled with the current
snapshot, not only delta records. A missing dependency is a blocker to resolve, never proof
that it landed. Preserve priority, overlap edges and separate commits.

After every required page is consumed, copy `current` to `previous` and scan again before
dispatch. If that check produces more changes, consume them before advancing. This detects
edits during intake without assuming git history or dates changed. It is not a tracker lock;
worker tamper checks still apply. Never acknowledge unread pages after truncated output.

After context loss, discard the old comparison baseline, run live wave status and reconstruct
the current wave's ticket records, dependency targets and in-flight assignments explicitly
from the tree and worker reports. Old fingerprints do not prove old reads remain known.
Remove this session's temporary directory when the drain ends.

Use content checksums rather than `updated`, mtimes or git diffs: edits may preserve dates,
and the tracker is usually ignored. Check integration history when an unexpected tracker
change needs explanation. Accept the live tree and mention a reshuffle in the next update.

## Worker check-back

- For ordinary judgment calls, resume the same worker with the canonical resume template.
- For tamper or overlap, identify the files and sittings. Wait for the earlier owner, land
  its work, then resume or redispatch the later sitting from current integration state.
  Never instruct either worker to overwrite the other's edits.
- For questions only the user can answer, accept a blocked report and apply the skill's
  failure policy.

Rebuild the graph after check-back. Check remaining citations for any newly discovered
shared path before dispatching again.

## Reporting to the user

Report one line per landed or blocked ticket: ID, outcome, verification headline and wave
position. Surface every self-filed ID even if previously mentioned.

Report the raw completion percentage with its limits. Later waves may contain heavier work;
`superseded` archives count as bookkeeping, not completed implementation.

Return incomplete reports to their author for missing landing or verification evidence.
Keep raw logs on disk; reports name commands, exit codes, available counts, failures and
absolute log paths. A runner's unavailable counter is `not reported`, never guessed or a
reason alone to repeat a successful check. Request bounded excerpts for unresolved failures.
Do not inspect implementation files to fill reports in.
