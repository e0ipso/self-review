---
type: map
title: Suggestion-apply write boundary
description: >-
  applySuggestion does the byte-compare and the write; resolveApplyDestination
  and setApplyDestination decide where, and never inside a temporary clone.
tags:
  - core
  - apply-suggestion
  - file-writes
  - remote-mode
kk_schema_version: 3
kk_id: map-suggestion-apply-write-boundary
kk_derived_from: []
kk_relates_to:
  - practice-limit-file-writes-to-the-review-xml-and-assets-directory
  - practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r
kk_depends_on: []
kk_confidence: high
---
The one sanctioned exception to the app's "writes only the review XML and its assets" rule, split
across four named pieces:

- `applySuggestion` (`packages/core/src/apply-suggestion.ts`) does the compare and the write. It
  takes an explicit absolute `destinationRoot`, never consults the current working directory, and
  rewrites the file only when the anchored lines still match `originalCode` byte for byte. Every
  other outcome is a refusal from `ApplyRefusalReason` and writes nothing.
- `resolveApplyDestination` and `setApplyDestination`
  (`packages/core/src/review-handlers.ts`) decide *where*. The default destination is the git
  repository root, the reviewed directory, or the reviewed file's parent;
  `setApplyDestination` records a reviewer-chosen directory and rejects any path that is not
  absolute, is not a directory, or resolves inside the temporary clone.
- `RemoteSessionInfo.temporaryClone` is the flag that tells the renderer this session's files live in
  a directory that is deleted on exit. Such a session has no destination of its own, so applies
  refuse with `destination-required` until the reviewer names one over
  `suggestion:choose-destination`.

The reviewer reaches all of this only by pressing Apply on one suggestion, over the
`suggestion:apply` channel. PRD Section 5.4.8 and the AGENTS.md "File writes" bullet are the
authorities; no apply path may ever resolve inside the temporary clone.

<!-- kk:related:start -->
# Related

- Related: [practice-limit-file-writes-to-the-review-xml-and-assets-directory](/app/practice-limit-file-writes-to-the-review-xml-and-assets-directory.md)
- Related: [practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r](/packages/architecture/practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r.md)
<!-- kk:related:end -->
