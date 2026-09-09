---
type: practice
title: Run npm run prepare in a fresh worktree or the pre-commit hook silently skips
description: >-
  core.hooksPath points at .husky/_, which husky generates and git never tracks,
  so a new worktree commits with no hook and no warning.
tags:
  - git
  - worktree
  - husky
  - hooks
  - gotcha
kk_schema_version: 3
kk_id: >-
  practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped
kk_derived_from: []
kk_relates_to:
  - practice-keep-extra-worktrees-out-of-the-repo-root
  - practice-formatting-is-enforced-by-lint-staged-and-ci
kk_depends_on: []
kk_confidence: high
---
`core.hooksPath` is set to `.husky/_`, and husky 9 generates that directory from the `prepare`
script and drops a `.gitignore` inside it. Git never tracks it, so a freshly created worktree has
`core.hooksPath` pointing at a directory that does not exist. Git treats a missing hooks path as no
hooks: the commit succeeds, nothing is printed, and the `lint-staged` + `npm run lint` +
`npm run test:unit` gate never fires. Copying `node_modules` in does not help, because `prepare`
only runs during an install in the checkout that owns it.

Run `npm run prepare` once in the worktree to restore it. That only brings the hook back; the hook
still needs `node_modules/.bin/lint-staged` present, and it refuses with a message rather than
running when it is not. When either is missing, run `npm run format:check`, `npm run lint` and
`npm run test:unit` by hand before every commit in that worktree. This is a property of worktrees
plus husky, not of any particular change.

<!-- kk:related:start -->
# Related

- Related: [practice-keep-extra-worktrees-out-of-the-repo-root](/engineering/practice-keep-extra-worktrees-out-of-the-repo-root.md)
- Related: [practice-formatting-is-enforced-by-lint-staged-and-ci](/engineering/practice-formatting-is-enforced-by-lint-staged-and-ci.md)
<!-- kk:related:end -->
