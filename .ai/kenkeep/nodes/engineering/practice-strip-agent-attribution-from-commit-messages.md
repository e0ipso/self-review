---
type: practice
title: Commitlint rejects agent attribution in the message and the author email
description: >-
  Any Co-authored-by trailer or AI tool attribution fails commit-msg; so does an
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
`.commitlintrc.cjs` extends `@commitlint/config-conventional` and adds three local rules, all at
error level. `no-ai-generated` scans the whole message and fails on any `Co-authored-by` trailer,
human or not; on `Assisted-by`, `Generated-by`, `Made-with` or `Signed-off-by` trailers naming an AI
tool; on tool-prefixed trailers such as `Amp-Thread:`; and on "generated with" or "made by" lines
naming one. `no-sift-ticket-ids` fails on a sift ticket ID, because those point at a private
tracker. `no-ai-author-email` reads `GIT_AUTHOR_EMAIL`, falling back to
the `user.email` git config, and fails when it contains any of eleven keywords, among them
`assistant`, `bot@` and several vendor names. `.husky/commit-msg` runs `npx commitlint --edit $1`, so both fire on every
local commit.

Several agent harnesses append such a trailer by default, this repo's own global instructions among
them, so a commit written with harness defaults is rejected: piping a message with that trailer into
`npx commitlint` exits 1 citing `no-ai-generated`. Drop the trailer rather than working around
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
