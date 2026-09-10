# `drain-log.sh report` cannot tell two concurrent sittings apart

Ready to file, but I could not establish the tracker URL from an installed copy. `skills-lock.json`
in the consumer repo records sift-drain as `"source": "../sift", "sourceType": "local"`, a sibling
checkout that does not exist in this container, and no sift URL appears in the installed skill,
in `.ai/sift/README.md`, or anywhere else in the repo. The other locked skills point at
`e0ipso/kenkeep` and `e0ipso/strikethroo`, so a matching `e0ipso/sift` is a guess, and I would
rather leave the field blank than write a guess as a fact. Fill in the tracker before filing. Not
yet submitted.

Drafted against the sift-drain copy installed at `.agents/skills/sift-drain/`, `computedHash`
`11d25b80bbd1e660ba887a445df857a9c78e44de7e4a555c26dd5fd3d4ac7884`. Line numbers below are from
`scripts/drain-log.sh`, 337 lines, sha256
`aa155b27176199ce734de3e24f2cc8a892a7484b050876030b4912196ec50508`.

## Environment

- bash 5, GNU awk and GNU coreutils `date`, Linux x86_64 dev container.
- The reproduction uses only the POSIX awk features the script already uses. `date -u -d @<epoch>`
  is GNU-only and appears in the fixture generator, not in anything proposed for the script.
- No `sift` source checkout, no network access to the upstream tracker.

## The reporter tracks one open group, but the contract dispatches many

SKILL.md line 94 stamps `drain-log.sh dispatch` immediately before each dispatch, and its wave
graph at line 88 fills every available slot with ready, non-overlapping sittings. Each worker then
stamps its own four phases from `references/ticket-agent-prompt.md` lines 59, 120, 168 and 181. So
several sittings write into one append-only log at once. The reader assumes they do not.

Group identity is the dispatch epoch, held in a single set of `og_*` variables:

- Line 190, `if (og && epoch != og_epoch) close_group(-1)`. A second sitting's dispatch closes the
  first one, and `close_group(-1)` marks it `INCOMPLETE (no return row)` with no runtime, at line
  155. The first sitting has not finished. It has not even been interrupted. It was simply not the
  most recent one to start.
- Line 190 again, in the other direction. Two dispatches in the same second take the `epoch ==
  og_epoch` path and merge into one group, so two unrelated one-ticket sittings become a single
  two-ticket group whose runtime belongs to neither.
- Line 201, `og_np++; og_pn[og_np] = phase`. A phase row carries no ticket and no owner, so it
  attaches to whichever group is open. After line 190 has closed the earlier sitting, that is
  always the newest dispatch. Phase durations then measure the gap between two different workers.
- Line 214. When the earlier sitting's worker returns, its ticket is no longer in the open group's
  membership, so the return is pushed as `ORPHAN (return with no dispatch row)`. The dispatch row is
  right there in the log.
- Lines 163 and 170, the idle gap. `prev_return` is a single global, so "idle before" measures the
  distance from an unrelated worker's return.

Every one of these fires when each caller follows the documented commands exactly. Nothing here is
misuse.

## Reproduction

Twelve rows, two sittings, no concurrency beyond what the drain contract prescribes. SR-1001 is
dispatched at T+0 and returns done at T+360. SR-1002 is dispatched at T+60 and returns done at
T+480. Each stamps its own four phases.

```bash
mkdir -p /tmp/sr0035/.ai/sift/config
printf 'prefix: SR\n' > /tmp/sr0035/.ai/sift/config/config.yaml
{
  printf '# Run log\n\nAppend-only. One row per drain event; rows are never rewritten.\n\n'
  printf '| event | ticket | phase | utc | epoch | status |\n|---|---|---|---|---|---|\n'
  base=1800000000
  while read -r off event ticket phase status; do
    e=$((base + off))
    printf '| %s | %s | %s | %s | %s | %s |\n' \
      "$event" "$ticket" "$phase" "$(date -u -d "@$e" +%Y-%m-%dT%H:%M:%SZ)" "$e" "$status"
  done
} > /tmp/sr0035/.ai/sift/RUNLOG.md <<'ROWS'
0 dispatch SR-1001 - -
30 phase - orient -
60 dispatch SR-1002 - -
90 phase - orient -
120 phase - implement -
150 phase - implement -
300 phase - verify -
330 phase - bookkeep -
360 return SR-1001 - done
400 phase - verify -
430 phase - bookkeep -
480 return SR-1002 - done
ROWS

SIFT_ROOT=/tmp/sr0035 scripts/drain-log.sh report
```

Output, exit 0:

```
group 1
  tickets: SR-1001 -
  runtime: -
  idle before: -
  phases: orient -
  per ticket resolved: -
  notes: INCOMPLETE (no return row)

group 2
  tickets: SR-1001 done
  runtime: -
  idle before: -
  phases: -
  per ticket resolved: -
  notes: ORPHAN (return with no dispatch row)

group 3
  tickets: SR-1002 done
  runtime: 420s (7m0s)
  idle before: -
  phases: orient 30s, implement 30s, implement 150s (2m30s), verify 30s, bookkeep 70s (1m10s), verify 30s, bookkeep 50s
  per ticket resolved: 420s (7m0s)
  notes: -

median runtime: 420s (7m0s) across 1 completed group(s) of 3
minutes per ticket resolved: 420s (7m0s) across 1 resolved ticket(s) in 1 completed group(s)
```

Two sittings produce three records. SR-1001 appears twice, once as an unfinished group and once as
an orphan, and its true 360s runtime appears nowhere. Group 3 absorbs seven phase rows, listing
`implement` and `verify` and `bookkeep` twice each, and its `implement 150s` is the gap between one
worker's implement stamp and another's.

The same-second variant is four rows: two independent one-ticket sittings dispatched in the same
second, returning at T+60 and T+900.

```
group 1
  tickets: SR-2001 done, SR-2002 done
  runtime: 900s (15m0s)
  idle before: -
  phases: -
  per ticket resolved: 450s (7m30s)
```

One 60-second sitting and one 15-minute sitting are reported as a single 15-minute group averaging
7m30s per ticket. No worker spent 7m30s on anything.

## What this costs on a real log

A 329-row `RUNLOG.md` from a live drain, sha256
`9a9c6de9322d4d5cbf837c9f8ec2ba8285815e23fe3168e9fca629d486316caf`, holding 79 dispatch rows, 176
phase rows and 73 return rows, 67 of them `done`, against 67 archived tickets on disk:

| figure | current report |
| --- | --- |
| groups | 79 |
| returns labelled ORPHAN | 43 of 73 |
| groups labelled INCOMPLETE | 20 |
| completed groups | 14 |
| tickets counted as resolved | 21 of 67 |

The log is intact and every caller followed the contract. The reader discards two thirds of it.
This is the diagnostic that was supposed to say where drain time goes.

## Proposed change

Give each sitting an identity that survives dispatch, phase and return, and let the reader hold
several sittings open at once.

### 1. A seventh column

Append `sitting` to the row, after `status`:

```markdown
| event | ticket | phase | utc | epoch | status | sitting |
|---|---|---|---|---|---|---|
| dispatch | SR-1001 | - | 2027-01-15T08:00:00Z | 1800000000 | - | 1800000000-a41f |
| phase | - | orient | 2027-01-15T08:00:30Z | 1800000030 | - | 1800000000-a41f |
```

Appending rather than inserting is what keeps an older reader working. `report` parses with
`-F'|'`, guards on `NF < 8` at line 175, and reads `$2` through `$7` positionally, so a trailing
field shifts nothing it looks at. Legacy rows keep six columns forever; the log stays append-only
and nothing is rewritten.

### 2. The dispatch mints the id and prints it

`dispatch` is the only command that can mint, because it is the only one the orchestrator runs
before the worker exists. Mint `<epoch>-<nonce>`, where the nonce is four hex characters, and print
the id on stdout so the orchestrator captures it instead of inventing one. Accept
`--sitting <id>` to reuse an id explicitly, which is what a retry of the same sitting needs, and
what makes the regression tests deterministic.

An explicit id is also the only way two dispatches land in one sitting. That answers the same-second
case directly: two mints in the same second differ in the nonce, so they are two sittings unless a
caller names one.

`phase` and `return` take the id the same way. Both must keep working without it, writing a legacy
six-column row, so that a worker running an older prompt degrades to today's behaviour instead of
failing. Today it does fail: `drain-log.sh phase orient 1800000000-1b9e` exits 2 on the usage
branch, and `dispatch --sitting X SR-3001` exits 2 with `error: not a ticket ID: --sitting`. Both
write nothing, so a mixed-version pair loses the row entirely.

### 3. Threading the id through the contract

The script change alone does nothing, because the worker stamps the phases. Three files move
together:

- `SKILL.md` line 94, capture the id `dispatch` prints and pass it to the worker.
- `references/ticket-agent-prompt.md`, a `{{SITTING_ID}}` row in the placeholder table that starts
  at line 20, the matching field in the Assignment block that starts at line 214, and the four phase
  stamps at lines 59, 120, 168 and 181.
- The `## Run log` section of the spec that ships as `.ai/sift/README.md` in a consumer repo,
  which is the copy an offline reader consults.

A retained worker taking a second sitting gets a new id in the newer Assignment block. A worker
resumed after a check-back keeps its id, and its repeated phase stamps are numbered by the reader
rather than overwritten.

### 4. Reader

Replace the single `og_*` group with a map keyed by sitting id. Per sitting: dispatch epoch, ticket
list with status, phases in order, last return epoch. Close a sitting when every one of its tickets
has a status. `INCOMPLETE` is decided in `END`, for sittings that still have a pending ticket when
the log runs out, and never by another sitting's arrival. A phase ends at the next phase of the
same sitting, or at that sitting's last return. A repeated phase name is labelled `orient#2` rather
than collapsed.

`ORPHAN` survives, but only for a return that no open sitting holds.

### 5. Legacy rows

A six-column row has no id, and the two halves of the log are not equally recoverable.

Dispatch and return rows are recoverable. Group legacy dispatch rows by epoch, as today, and match a
legacy return to the newest open legacy sitting that holds that ticket, rather than to the single
most recent group. That alone removes every false orphan.

Phase ownership is not recoverable. A legacy phase row carries no ticket and no id, and any rule for
attributing it is a guess dressed as a measurement. Collect legacy phase rows into one count,
exclude them from every phase figure, and say so in the output. An unattributed count is worth more
than a plausible attribution.

### 6. Summary lines

With concurrency, summing sitting runtimes double counts wall-clock time. Report both, and label
which is which: summed sitting time across completed sittings, and the drain's wall clock from
first row to last. On the live log above those are 7h13m and 17h34m, and the gap is the answer to a
different question than the one the current single total pretends to answer.

## Observed output from a prototype reader

I wrote a prototype implementing sections 4 to 6 and ran it over the same fixtures. It is evidence
that the scheme produces correct figures. It is not a patch. The same twelve-row scenario, with the
seventh column filled in:

```
sitting 1800000000-a41f
  tickets: SR-1001 done
  runtime: 360s (6m0s)
  phases: orient 90s (1m30s), implement 180s (3m0s), verify 30s, bookkeep 30s
  per ticket resolved: 360s (6m0s)
  notes: -

sitting 1800000060-7c02
  tickets: SR-1002 done
  runtime: 420s (7m0s)
  phases: orient 60s (1m0s), implement 250s (4m10s), verify 30s, bookkeep 50s
  per ticket resolved: 420s (7m0s)
  notes: -

completed sittings: 2 of 2
summed sitting time: 780s (13m0s) across 2 completed sitting(s)
drain wall clock: 480s (8m0s) from first to last row
per ticket resolved: 390s (6m30s) across 2 resolved ticket(s)
```

Both runtimes match the fixture, each sitting owns four phases, and neither the false INCOMPLETE nor
the false ORPHAN appears. The same-second fixture reports 60s and 900s separately.

The legacy path, running the prototype over the original six-column fixture:

```
sitting (legacy epoch 1800000000)
  tickets: SR-1001 done
  runtime: 360s (6m0s)
  phases: -
...
unattributed phases: 8 legacy phase row(s) carry no sitting id.
  Ownership is not recoverable; these are excluded from every phase figure.
```

Both runtimes come back from ticket identity alone. The eight phase rows are counted and disowned.

Over the 329-row live log, the prototype reports 34 sittings, 0 orphan returns, 31 completed, 67
resolved tickets, and 176 unattributed legacy phase rows. Sixty-seven matches the archived ticket
count exactly. The current reader says 21.

## Compatibility, measured in both directions

- Current `report`, reading a seven-column log: exit 0, and output byte-identical to its reading of
  the six-column version of the same events, confirmed with `diff`. It gains nothing and it breaks
  nothing.
- Prototype reader, reading a six-column log: exit 0, both runtimes recovered, phases disowned as
  above.

## Sequencing

1. Land the script change first, with the sitting operand optional on all three subcommands. A
   worker on an older prompt keeps writing six-column rows.
2. Land the reader change with it, since it is the same file.
3. Then update `SKILL.md`, `ticket-agent-prompt.md` and the `## Run log` spec section. Any other
   order leaves a window where a worker stamps an argument the installed script rejects with exit
   2, and the row is lost rather than degraded.

## Checks to run before closing this

1. Two interleaved sittings, one dispatched while the other is mid-flight. Expect two records,
   both with runtimes, no INCOMPLETE and no ORPHAN. The twelve-row fixture above is this case.
2. Phases correlate with their owning sitting, including a repeated phase from a resumed worker.
   Expect `orient` and `orient#2` under one sitting, not two sittings.
3. Two sittings dispatched in the same second. Expect two records. Then two dispatch calls sharing
   an explicit `--sitting` id. Expect one record.
4. A six-column legacy log. Expect runtimes recovered from dispatch and return pairs, and phase
   rows reported as unattributed rather than assigned to any sitting.
5. A mixed log, legacy rows followed by keyed rows. Expect both halves reported.
6. The current reader over a keyed log, and the new reader over a legacy log. Expect exit 0 from
   both.
7. Regression coverage for 1 through 6 in the source repo's harness, plus a sequential
   single-sitting log, which is the path the current reader gets right and the one a rewrite is
   most likely to break. The installed skill ships no tests, so I cannot see where these belong.

Check 7 is the one I would not skip. Every failure above is a reader that was correct for a
sequential drain and was never re-examined when the contract started dispatching in parallel.

## What was verified while drafting this

All of it on a disposable copy of `drain-log.sh` in `/tmp`, byte-identical to the installed script
by sha256, with synthetic logs. The live `RUNLOG.md` was copied and read, never written.

- The twelve-row and four-row reproductions above, run against that copy, exit 0, output quoted
  verbatim.
- The live-log figures, both readers run over one pinned snapshot.
- `drain-log.sh phase orient <id>` exits 2 through the usage branch, and
  `drain-log.sh dispatch --sitting X SR-3001` exits 2 at `require_ticket_id`. Neither appends a row;
  the fixture log was unchanged after both.
- The seventh-column compatibility claim, by `diff` of the current reader's output over the
  six-column and seven-column forms of the same events.
- What I did not verify: the proposed nonce minting, since I wrote no patch. Four hex characters
  make a same-second collision unlikely rather than impossible, and a maintainer may prefer a
  counter derived from the log tail. The choice does not affect the reader.
