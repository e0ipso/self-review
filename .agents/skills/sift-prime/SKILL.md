---
name: sift-prime
description: Use when the user asks to prime or seed a Sift backlog, find repository work, or turn stated goals into `.ai/sift` tickets. Analyze gaps, negotiate the slate, reserve IDs, and draft wave-assigned tickets in batches.
---

# Prime Sift

Find gaps between the project's stated intent and its files. Agree on a slate with the
user, then write tickets for `sift-drain`.

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

Delegate analysis to read-only sweep agents and ticket writing to batch drafters. Work
from their reports, existing milestone definitions and the agreed slate. Send questions
about source evidence back to the sweep agent rather than inspecting implementation code.
You write agreed milestone definitions and call the ID allocator. Never commit, push or
write to an external tracker during priming.

## Scripts

Resolve this skill's `scripts/` directory once. Call the helpers rather than reproducing
their parsing. They use the nearest ancestor `.ai/sift` and its configured prefix;
`SIFT_ROOT` and `SIFT_PREFIX` override them. Exit 2 indicates setup or usage failure.

```sh
scripts/existing-work.sh <term>... # search open and archived tickets for dedupe
scripts/reserve-ids.sh <count>    # persistently reserve a contiguous ID batch
```

Use `find` and `command grep`, or no-ignore search, inside the usually ignored tracker.

## Phase 1: Analyse

Read [analysis.md](references/analysis.md) before dispatch. It defines the evidence bar,
sweep dimensions, finding format, clustering and dedupe. With a user scope fence, read
and report only inside it. Without a fence, sweep at full breadth.

`tests/static/prime-scope-contract.test.sh` checks this boundary:

```text
@PRIME-SCOPE: fenced reads-and-reports-inside
@PRIME-SCOPE: unfenced full-breadth
```

### Synthesize milestones

After dedupe, assign milestones using the findings and existing milestone definitions.
Ask the same sweep agent a focused follow-up if evidence is missing. Include shared
interfaces, defaults and acceptance criteria in the proposed slate.

Reuse a milestone when its outcome fits; otherwise propose a repository-specific,
kebab-case name and short outcome description. Group by project outcome, not type or
directory. Do not target a milestone count. Use `backlog` only for findings the evidence
cannot classify, and explain each exception. If it is the only existing milestone and
findings express several outcomes, propose named milestones.

## Phase 2: Negotiate

Present new milestones, then the slate. Each row includes title, type, priority, effort,
milestone, rationale, citations, dependency edges and an explicit wave number. Rows with
no slate dependencies start in Wave 1; place others in the first wave after all their
slate dependencies. Show every cited site in clustered rows and name what dedupe dropped.

Ask for agreement and apply requested changes. Keep negotiation in chat; create no files
before approval. The user decides the ticket count.

## Phase 3: Write

Reserve all approved IDs in one call before drafting:

```sh
scripts/reserve-ids.sh <number of agreed slate rows>
```

The allocator records reservations before printing IDs. Keep unused reservations as gaps.
Exit 3 means the shared lock is busy or unavailable: retry after its owner finishes;
never calculate a next ID yourself.

Write agreed new milestones into `MILESTONES.md` and create their `open/<milestone>/`
folders before dispatch. Validate assigned metadata, including lowercase effort,
positive waves and dependency ordering. You own wave, cluster and dependency values.

Use [drafting-agent-prompt.md](references/drafting-agent-prompt.md) verbatim with the
approved rows, shared decisions and one date for the slate. Use one batch by default;
split only when subject boundaries or size warrant separate contexts. Batches own disjoint
paths. Prefer fresh task contexts containing these inputs, without the negotiation history.
Resume the same drafter for corrections and preserve completed rows on partial failure.

## Phase 4: Verify and report

After all batches return, run `bash .ai/sift/scripts/sift.sh consistency` and
`bash .ai/sift/scripts/sift.sh required`. Fix findings
caused by this run. A reserved dependency may be absent during drafting; validate it here.

Report written IDs with titles, types and priorities, grouped by wave; blocked rows and
reasons; and the inspected scope if fenced. Make no claims about uninspected paths.
State that nothing was committed or pushed, and identify `sift-drain` as the next step.

## Contract pins

`tests/static/skill-prose-pins.test.sh` checks these external references.

```text
@PIN: src/skills/sift-prime/ name: sift-prime
@PIN: src/skills/sift-prime/references/analysis.md ## The evidence bar
@PIN: src/skills/sift-prime/references/drafting-agent-prompt.md ## When a drafting agent returns blocked
```
