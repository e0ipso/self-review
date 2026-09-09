---
type: map
title: self-review CLI invocations
description: >-
  Review local diffs, directories or forge URLs, or fetch comments headlessly.
tags:
  - cli
  - flags
kk_schema_version: 3
kk_id: map-self-review-cli-invocations
kk_derived_from:
  - README.md
  - AGENTS.md
kk_relates_to:
  - map-resume-from-for-continuing-a-prior-review
  - map-three-startup-modes-git-directory-welcome
  - practice-hide-untracked-files-by-default-for-staged-cached-reviews
  - practice-never-write-to-stdout-in-the-main-process
  - practice-never-write-to-stdout-use-stderr-for-all-logging
  - practice-preserve-orphaned-comments-on-resume-never-silently-drop-them
  - practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg
  - practice-treat-self-review-as-a-cli-first-one-shot-tool
kk_depends_on: []
kk_confidence: high
---
Use self-review --staged, self-review main or self-review HEAD^ for git diffs; --resume-from loads an existing review. Outside a git repo, self-review with no directory argument opens the welcome screen. A directory argument opens directory review. A GitHub PR or GitLab MR URL opens remote review; self-review fetch-comments <URL> writes fetched threads headlessly. Output defaults to ./review.xml.

<!-- kk:citations:start -->
# Citations

[1] [README.md](../../../../../README.md)
[2] [AGENTS.md](../../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-resume-from-for-continuing-a-prior-review](map-resume-from-for-continuing-a-prior-review.md)
- Related: [map-three-startup-modes-git-directory-welcome](map-three-startup-modes-git-directory-welcome.md)
- Related: [practice-hide-untracked-files-by-default-for-staged-cached-reviews](practice-hide-untracked-files-by-default-for-staged-cached-reviews.md)
- Related: [practice-never-write-to-stdout-in-the-main-process](practice-never-write-to-stdout-in-the-main-process.md)
- Related: [practice-never-write-to-stdout-use-stderr-for-all-logging](practice-never-write-to-stdout-use-stderr-for-all-logging.md)
- Related: [practice-preserve-orphaned-comments-on-resume-never-silently-drop-them](practice-preserve-orphaned-comments-on-resume-never-silently-drop-them.md)
- Related: [practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg](practice-show-welcome-screen-when-launched-outside-a-git-repo-with-no-directory-arg.md)
- Related: [practice-treat-self-review-as-a-cli-first-one-shot-tool](practice-treat-self-review-as-a-cli-first-one-shot-tool.md)
<!-- kk:related:end -->
