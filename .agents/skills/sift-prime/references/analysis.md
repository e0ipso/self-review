# Goal-gap analysis

Find gaps between the project's stated intent and its implementation.

## Sources of stated intent

Read in this order:

1. Repository `README.md`.
2. `AGENTS.md` / `CLAUDE.md` and their included files.
3. `.ai/sift/MILESTONES.md`.
4. Knowledge-base index, then entries relevant to the scope or dimension.

Do not propose practices, defaults or architecture the project has not adopted.

## The evidence bar

Rule markers: `tests/static/readme-rule-citations.test.sh`.

Every claim needs `file:line` for existing code or `absent: <path>` for an exact path
checked and missing. Drop uncitable candidates. Lower priority does not excuse missing
evidence; the drafter cannot supply it later.

```text
@RULE: README.md 5 Claims about code cite
```

## The scope fence

The user's optional prompt is a hard scope fence. Read and report only inside it. Name
the inspected scope without claiming anything about uninspected paths. Without a fence,
cover all stated-intent sources and seven dimensions. Keep the same evidence bar in both
cases. `tests/static/prime-scope-contract.test.sh` checks this boundary.

```text
@PRIME-SCOPE: fenced reads-and-reports-inside
@PRIME-SCOPE: unfenced full-breadth
```

## The sweep dimensions

Each dimension assigns the matching ticket `type` and category folder.

Pins: `tests/static/skill-prose-pins.test.sh`.

```text
@PIN: README.md bug | hardening | feature | test | docs | dx | release
```

| Dimension | Look for |
|---|---|
| `bug` | Behaviour contradicting docs, tests or code comments |
| `hardening` | Missing validation, error handling, portability or required guards |
| `feature` | Promised or milestone-required capability missing from code |
| `test` | Behaviour without assertions; suites skipping claimed coverage |
| `docs` | Stale documentation or undocumented public behaviour |
| `dx` | Repeated manual work in the project's contributor workflow |
| `release` | Missing promised packaging, versioning, registration or distribution |

Use one read-only sub-agent per dimension, or per scope slice for a fenced run. Sweep
agents write nothing and run no state-changing git commands. The orchestrator consumes
their reports without rereading source. Use `find` and `command grep` inside ignored
`.ai/sift` paths.

## What a finding looks like when it reaches the orchestrator

Return only this block per finding, without source excerpts or narration:

```
finding:  <imperative title>
type:     bug | hardening | feature | test | docs | dx | release
why:      <one line: what is wrong or missing, and who it costs>
evidence: <file:line, or absent: <path>; one or more>
```

The drafter uses `why` for Problem and copies `evidence` verbatim.

## Plurality

There is no target count. Propose every qualifying candidate; the user chooses survivors.

## Clustering rules

Cluster by root cause after the evidence bar and before dedupe. Milestones later group
survivors by outcome.

### The one-Direction test

Merge sites only when one `## Direction` applies unchanged to each. Write it to check.
Separate sites that need different actions, even if their symptoms match.

### One citation per site

Keep and show one `file:line` citation per site. Drop uncitable members. The user may split,
merge or remove sites during negotiation.

### Split tickets keep the cluster

Different Directions or milestones require separate tickets. If they share a root cause,
assign the same optional kebab-case `cluster`. A shared symptom alone does not qualify.

## Dedupe

After the sweep, query each surviving candidate separately:

```sh
scripts/existing-work.sh <term>...
```

Use multiple distinguishing terms for its files, symptom or mechanism, including alternate
wording. Do not prefetch with scope-wide vocabulary. The helper searches open and archived
tickets and returns tab-separated ID, status, type, title and resolution.

Drop duplicates of open, blocked, in-progress or terminal tickets, including `wontfix`.
Name their IDs in the slate. Ignore rows that merely share words. A resolution ending in
`...` is truncated; read that ticket before quoting its resolution verbatim.

Empty output with exit 0 means no terms matched, not proof of novelty. Try alternate terms.
An overflow notice on stderr means the results are incomplete despite exit 0; narrow and
repeat the query before judging duplicates.

## When the corpus and the sweep disagree

If an open ticket's evidence is stale, note it beside the slate. Do not rewrite it or
propose it as new work.

## Chat-only negotiation

Keep findings in the conversation until approval. Create no scratch files or drafts
anywhere. If the session ends before approval, rerun the analysis.
