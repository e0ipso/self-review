---
type: practice
title: Put work that needs the reviewed diff after loadDiff in bootstrapRemoteDiff
description: >-
  startRemoteSession runs before any diff exists; anything that anchors against
  files belongs in bootstrapRemoteDiff after loadDiff.
tags:
  - core
  - remote-mode
  - ordering
  - gotcha
kk_schema_version: 3
kk_id: >-
  practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff
kk_derived_from: []
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`packages/core/src/remote-mode.ts` splits remote startup in two. `startRemoteSession` materializes
the clone and fetches forge threads; no diff exists yet, so its
`mapThreadsToReviewComments(fetchedThreads)` call passes no files. `bootstrapRemoteDiff` then calls
`loadDiff`, applies the ignore filter, and re-maps the threads against the filtered files. Any step
that needs the reviewed diff must sit after that `loadDiff`, inside `bootstrapRemoteDiff`: anchoring
a `suggestion` fence, resolving a path, validating a line range.

This fails silently when you get it wrong. SR-0050 shipped suggestion extraction in
`startRemoteSession` and it did nothing in the app for exactly this reason: the mapper had no files
to anchor against, so it dropped every suggestion without an error. The headless
`fetch-comments` path is what keeps the diff-less mapping call alive, so its existence is not
permission to add diff-dependent work beside it.
