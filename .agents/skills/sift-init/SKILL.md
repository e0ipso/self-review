---
name: sift-init
description: This skill should be used when the user asks to "initialize sift", "set up sift", "add sift to this repo", "create the sift tree", or when any other sift skill needs to confirm that `.ai/sift` exists before it runs. Provides the deterministic project-root gate every sift skill runs first, and the idempotent tree materialization behind it.
---

# Initialize Sift

Follow this contract in order. Resolve the project root first. Materialization is the
only write, and it is idempotent.

## Identity pin

The installable name must match the directory that holds this skill. The line below is
machine-read by `tests/static/skill-prose-pins.test.sh`; its target ends in `/`, so the
test looks for the construct in that directory's `SKILL.md` front matter.

```text
@PIN: src/skills/sift-init/ name: sift-init
```

## 1. Resolve the root and inspect the tree

**Input.** Start from the canonicalized `$PWD`. `SIFT_ROOT=/path` overrides the walk.
Resolve the gate script's absolute path once and reuse it.

**Command.** Every sift skill runs this before doing anything else:

```sh
scripts/sift-gate.sh
```

The gate reads only and never asks the user a question. Without `SIFT_ROOT`, it makes
one upward walk to `/`, records the nearest match in each tier, then applies tier
precedence:

| Precedence | Match | Result |
|---|---|---|
| A | `-d $dir/.ai/sift` | adopt the existing tree |
| B | `-e $dir/.git` | use the repository root |
| C | `-f $dir/AGENTS.md` or `-f $dir/CLAUDE.md` | use the agent-instructed project root |

A beats B, and B beats C, regardless of distance. Tier A prevents a nearer nested
repository from splitting the ticket ID space after initialization. The `.git` check
uses `-e`, because worktrees and submodules may store `.git` as a file. `$HOME` and `/`
are inspected but excluded as roots, so a user-level agents file cannot claim them.

**Output.** The gate prints these `key=value` lines as applicable:

```text
state=READY|INCOMPLETE|UNINITIALIZED|UNRESOLVED
root=<absolute path>
tier=A|B|C|override
marker=<matched entry>
corroboration=<other markers at the root, comma-separated, or none>
confidence=high|low
missing=<required entries, comma-separated>
prefix=<configured prefix>
```

`root`, `tier`, `marker`, and `corroboration` appear for a resolved root.
`confidence` appears only for `UNINITIALIZED`, `missing` only for `INCOMPLETE`, and
`prefix` only for `READY`. `UNRESOLVED` prints `state=UNRESOLVED` and writes the reason
to stderr.

**Result and required action.** The exit code decides the next step:

| Exit | `state=` | Required action |
|---|---|---|
| 0 | `READY` | Proceed with the requested sift task. |
| 3 | `UNINITIALIZED` | Tier B found a high-confidence root; initialize without asking about the root. |
| 4 | `UNINITIALIZED` | Tier C found a low-confidence root; report the path and ask before writing. |
| 5 | `UNRESOLVED` | Report the `$PWD` that was searched and ask for an explicit root. |
| 6 | `INCOMPLETE` | Repair without asking, using the materialization command in step 3. |
| 2 | n/a | Report the usage or environment error and stop. |

`tests/static/gate-handoff-contract.test.sh` compares the exit 4 and 6 actions here
with the gate script and both consuming skills.

## 2. Choose and validate the inputs

**Input.** Use `ROOT` from the gate. Choose an immutable prefix and, optionally, the
first milestone. The prefix appears in every ticket ID, filename, and inline
`PREFIX-XXXX` reference, so confirm it before any write. The default milestone is
`backlog`.

**Command.** Derive a prefix suggestion, show it to the user, and allow an override:

```sh
scripts/sift-init.sh --suggest-prefix --root "$ROOT"
```

The suggestion strips non-alphanumerics from the root basename, uppercases it, and
takes the first four characters. Exit 0 prints the suggestion. Exit 1 prints nothing,
so ask the user for a prefix.

**Validation.** A supplied prefix must contain 2 to 8 uppercase ASCII letters or
digits and start with a letter. A milestone must be lowercase kebab-case: lowercase
letters and digits in hyphen-separated groups, such as `backlog` or `v1-2`. Empty
values, path characters, spaces, uppercase milestone letters, and leading, trailing,
or doubled milestone hyphens are invalid. Any invalid or missing input exits 2 before
the script creates a directory.

## 3. Materialize or repair the tree

**Input.** Use the resolved `ROOT`, confirmed prefix, and optional milestone. An
`INCOMPLETE` tree uses this same command. Keep its configured prefix when one exists;
if the prefix is missing, choose and confirm one through step 2.

**Command.** Run:

```sh
scripts/sift-init.sh --root "$ROOT" --prefix ACME [--milestone <name>]
```

**Created entries.** The command creates only absent paths:

```text
.ai/sift/
├── .gitignore             <- `*` and `!.gitignore`; fresh trees only
├── README.md              <- copied byte for byte from the skill assets
├── MILESTONES.md          <- generated with the first milestone
├── config/config.yaml     <- generated with the prefix
├── schemas/*.{xsd,xml}    <- schemas and optional XML example
├── scripts/sift.sh        <- local tracker operations
├── open/<milestone>/      <- empty; the first ticket creates its category
└── archive/               <- empty
```

`README.md`, `scripts/sift.sh` and the XSD/XML assets are copied byte for byte. A repeat run repairs missing entries and keeps every existing
entry. It does not restore a missing `.gitignore`; that absence is the repository's
opt-in to tracking the sift tree.

**Publication guarantee.** A bare `mkdir` claims `.ai/sift`, so one concurrent writer
wins and the others enter the repair path. Each file is staged beside its destination,
then published create-if-absent with `ln`; a writer that loses the link race keeps the
file already published. Readers never see a partially written file. On a filesystem
without hard-link support, the script falls back to a same-directory atomic `mv`.

**Output and failures.** Exit 0 prints the tree path, one `created` or `kept` line for
each managed entry, `prefix: <value>   first milestone: <value>`, and `gate: READY`.
It may also print the comparison findings from step 4. Exit 2 reports a usage,
filesystem, asset, publication, or final gate failure. Stop on exit 2 and report the
diagnostic; never compensate by overwriting an existing path.

## 4. Review installed convention drift

**Input and comparison.** Compare README, script and XSD/XML assets with their installed
copies. This check reads only.

**Output.** A differing installed copy prints a `stale` line. An installed schema that
the skill no longer ships prints an `orphan` line. Matching files stay on the ordinary
`kept` lines. The report offers these copy commands for stale files, with absolute
paths already substituted:

```sh
cp <skill>/assets/README.md <root>/.ai/sift/README.md
cp <skill>/assets/schemas/*.xsd <skill>/assets/schemas/*.xml <root>/.ai/sift/schemas/
cp <skill>/assets/scripts/sift.sh <root>/.ai/sift/scripts/sift.sh
```

For each orphan, it prints an `rm` command instead. Copying cannot remove a withdrawn
schema, and the installed file may be repository-owned.

**Required action.** Name the findings and offer the printed commands. Ask for explicit
approval before running any copy or removal command. An installed spec may contain
repository annotations, so refresh is never part of init or repair.

## 5. Report and stop

Report these fields after a successful run:

- resolved root
- permanent prefix
- first milestone, noting that it is a placeholder
- gate state `READY`
- convention drift findings and offered remedies, if any
- tracking policy and its opt-out

The default tracking policy is untracked. A fresh `.ai/sift/.gitignore` contains `*`
and `!.gitignore`, so the tree ignores itself. Deleting that file opts the whole backlog
into tracking. Ignore-aware search such as `rg` then skips an untracked sift tree; use
`find` plus `command grep` when working inside it.

Never edit the repository root `.gitignore`. Init owns `.ai/sift` only. It does not
create a first ticket, file any backlog work, or perform any requested sift task after
the gate becomes ready.

## 6. Maintain the shipped assets

Sources are `README.md`, `schemas/` and `src/operations/sift.sh`; shipped copies live in
`src/skills/sift-init/assets/`. After changing a source, run:

```sh
src/skills/sift-init/scripts/sync-assets.sh
```

It copies the normative files, mirrors schema additions and removals, then exits
non-zero if drift remains. Do not hand-copy the assets or add a separate `diff` step.
