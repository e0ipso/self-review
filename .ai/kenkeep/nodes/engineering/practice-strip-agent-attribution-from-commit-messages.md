---
type: practice
title: Commitlint rejects agent attribution in the message and the author email
description: >-
  A Co-Authored-By trailer naming an assistant fails commit-msg; so does an
  author email carrying an assistant keyword.
tags:
  - git
  - commitlint
  - husky
  - commits
kk_schema_version: 3
kk_id: practice-strip-agent-attribution-from-commit-messages
kk_derived_from: []
kk_relates_to:
  - >-
    practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped
  - practice-use-conventional-commit-naming-for-pr-titles
kk_depends_on: []
kk_confidence: high
---
`.commitlintrc.cjs` extends `@commitlint/config-conventional` and adds two local rules, both at
error level. `no-ai-attribution` scans the body and footer against a pattern list and fails on a
`Co-Authored-By` trailer naming an assistant vendor, on a robot-emoji "generated with" line, and on
phrases claiming machine authorship. `no-ai-author-email` reads `GIT_AUTHOR_EMAIL`, falling back to
the `user.email` git config, and fails when it contains any of eleven keywords, among them
`assistant`, `bot@` and several vendor names. `.husky/commit-msg` runs `npx commitlint --edit $1`, so both fire on every
local commit.

Several agent harnesses append such a trailer by default, this repo's own global instructions among
them, so a commit written with harness defaults is rejected: piping a message with that trailer into
`npx commitlint` exits 1 citing `no-ai-attribution`. Drop the trailer rather than working around
the hook. History does contain commits carrying it, made in a worktree where `npm run prepare` had
never run, which leaves the husky hooks unwired and silently unenforced.

**Why:** The rejection arrives at commit time, after the work is staged, and the error text names
the rule rather than the offending line. Knowing the trailer is the cause turns a confusing failure
into a one-line edit.

<!-- kk:related:start -->
# Related

- Related: [practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped](/engineering/practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md)
- Related: [practice-use-conventional-commit-naming-for-pr-titles](/engineering/practice-use-conventional-commit-naming-for-pr-titles.md)
<!-- kk:related:end -->
