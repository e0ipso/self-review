---
type: practice
title: 'Spawn git with an argv array, never a shell string'
description: >-
  Diff arguments reach git through execFile; joining argv into a command line
  let a command substitution run.
tags:
  - security
  - git
  - subprocess
  - shell-injection
kk_schema_version: 3
kk_id: practice-spawn-git-with-an-argv-array-never-a-shell-string
kk_derived_from: []
kk_relates_to:
  - practice-convert-git-diff-args-only-through-format-and-tokenize
kk_depends_on: []
kk_confidence: high
---
Every git invocation passes its arguments as an array to `execFile`/`execFileAsync`, never as a joined
command line to a shell. `getGitDiffStats` in `packages/core/src/payload-sizing.ts` used to build one
string, and a `$(...)` element among the diff arguments ran as a command; it now calls
`execFile('git', ['diff', '--numstat', ...args], ...)`.

Diff arguments are user input. They arrive from the command line, from `default-diff-args` in YAML and
from the `git-diff-args` attribute of a resumed review document, so any code path that reconstructs a
shell string from them is an injection. The `shell: true` option and template-literal command
construction are both out for this reason.

<!-- kk:related:start -->
# Related

- Related: [practice-convert-git-diff-args-only-through-format-and-tokenize](/app/cli/practice-convert-git-diff-args-only-through-format-and-tokenize.md)
<!-- kk:related:end -->
