---
type: practice
title: Scrub git's repository env vars before spawning git in tests
description: >-
  Git's hook environment outranks cwd and git -C; packages/core/vitest.setup.ts
  strips it so suites stay hermetic.
tags:
  - testing
  - git
  - hooks
  - hermetic-tests
kk_schema_version: 3
kk_id: practice-scrub-git-repository-env-vars-before-spawning-git-in-tests
kk_derived_from: []
kk_relates_to:
  - map-testing-layers-unit-e2e
kk_depends_on: []
kk_confidence: high
---
Git exports its repository-resolution environment into every hook process: `GIT_DIR`, `GIT_COMMON_DIR`,
`GIT_INDEX_FILE`, `GIT_WORK_TREE`, `GIT_PREFIX`, `GIT_OBJECT_DIRECTORY` and the rest of the list in
`GIT_REPO_ENV_VARS`. Those variables outrank both a child process's working directory and `git -C <dir>`,
so a suite that shells out to git from inside a `pre-commit` hook, a rebase or `bisect run` acts on the
surrounding repository instead of on its own temp fixture. It commits to the checked-out branch and
rewrites the shared config. A linked worktree is the case that hurts most, because git exports an
absolute `GIT_DIR` there.

`packages/core/vitest.setup.ts` calls `stripGitRepoEnv()` so every core test starts from a clean
environment. Test code that spawns git directly goes through `gitSync`, and code that assembles an env
for a child uses `withoutGitRepoEnv`; both live in `packages/core/src/test-support/git-env.ts`. Extend
`GIT_REPO_ENV_VARS` there rather than scrubbing ad hoc at a call site. Nothing under `test-support/` is
re-exported from `src/index.ts`, so none of it ships in the published bundle.

<!-- kk:related:start -->
# Related

- Related: [map-testing-layers-unit-e2e](/engineering/map-testing-layers-unit-e2e.md)
<!-- kk:related:end -->
