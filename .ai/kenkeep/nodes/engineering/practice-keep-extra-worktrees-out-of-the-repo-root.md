---
type: practice
title: Keep extra worktrees out of the repo root
description: >-
  ESLint and Prettier walk a nested worktree even when git excludes it, and a
  hardlinked node_modules is shared.
tags:
  - worktree
  - tooling
  - lint
  - node-modules
kk_schema_version: 3
kk_id: practice-keep-extra-worktrees-out-of-the-repo-root
kk_derived_from: []
kk_relates_to:
  - practice-formatting-is-enforced-by-lint-staged-and-ci
kk_depends_on: []
kk_confidence: medium
---
A git worktree created under the repository root breaks `npm run lint` and `npm run format:check`.
`eslint .` walks everything not matched by the `ignores` list in `eslint.config.mjs`, and Prettier reads
`.gitignore` and `.prettierignore` but not `.git/info/exclude`, which is where a locally created
worktree usually gets excluded. Both then lint the second checkout's copy of the tree. Put auxiliary
worktrees outside the repository root, or add the directory to `.gitignore`, `.prettierignore` and the
ESLint `ignores` list together.

If such a worktree was populated by hardlinking `node_modules` from another checkout, its files share
inodes with the original. Anything that rewrites a file in place under `node_modules` mutates the other
checkout through the shared inode. `npm install --package-lock-only` is one of them: it rewrites
`node_modules/.package-lock.json`. Treat a hardlinked `node_modules` as read-only and run installs in
the checkout that owns it.

<!-- kk:related:start -->
# Related

- Related: [practice-formatting-is-enforced-by-lint-staged-and-ci](/engineering/practice-formatting-is-enforced-by-lint-staged-and-ci.md)
<!-- kk:related:end -->
