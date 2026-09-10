---
type: practice
title: Write node_modules without a trailing slash in .gitignore
description: >-
  A trailing slash matches directories only, so the symlinked node_modules a
  prepared worktree gets shows up as untracked.
tags:
  - git
  - gitignore
  - worktree
  - tooling
kk_schema_version: 3
kk_id: practice-write-node-modules-without-a-trailing-slash-in-gitignore
kk_derived_from: []
kk_relates_to:
  - >-
    practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped
  - practice-keep-extra-worktrees-out-of-the-repo-root
kk_depends_on: []
kk_confidence: high
---
`.gitignore` carries `node_modules` with no trailing slash, and it has to stay that way. A trailing
slash restricts a pattern to directories, and a worktree prepared for agent work gets `node_modules`
as a symlink into the primary checkout rather than a real directory. Git does not follow it, so
`node_modules/` fails to match: `git check-ignore node_modules` finds nothing and `git status`
reports `?? node_modules` in every such worktree.

`.prettierignore` keeps `node_modules/` and `eslint.config.mjs` keeps `**/node_modules/**` on
purpose. Neither tool descends into a symlinked directory to begin with, so the slash costs nothing
there. This is a git-only rule; do not "fix" the other two ignore files to match.

**Why:** An untracked `node_modules` buries real changes in `git status` and invites an accidental
`git add .` that commits a symlink.

<!-- kk:related:start -->
# Related

- Related: [practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped](/engineering/practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md)
- Related: [practice-keep-extra-worktrees-out-of-the-repo-root](/engineering/practice-keep-extra-worktrees-out-of-the-repo-root.md)
<!-- kk:related:end -->
