---
type: practice
title: Re-exec with headless Ozone for windowless subcommands
description: >-
  Packaged fuses disable RunAsNode, so ELECTRON_RUN_AS_NODE cannot make a
  subcommand headless; cli-dispatch re-execs.
tags:
  - electron
  - cli
  - packaging
  - headless
kk_schema_version: 3
kk_id: practice-re-exec-with-headless-ozone-for-windowless-subcommands
kk_derived_from: []
kk_relates_to:
  - map-self-review-cli-invocations
kk_depends_on: []
kk_confidence: high
---
`forge.config.ts` ships `FuseV1Options.RunAsNode: false`, so `ELECTRON_RUN_AS_NODE` is inert in a
packaged build and cannot be used to run a subcommand such as `fetch-comments` as plain Node. Moving
imports around does not help either: an async subcommand returns control to the main script while its
promise is still pending, and Electron goes on to initialise its toolkit, which needs a display.

The remedy is in `src/main/cli-dispatch.ts`. `needsHeadlessReexec` decides whether to start a second
process, and `reexecHeadless` re-runs the same binary once with `HEADLESS_OZONE_SWITCH`
(`--ozone-platform=headless`) prepended, forwards the child's stdio and exits with its status. The
`SELF_REVIEW_HEADLESS` env var guards against a re-exec loop, an explicit `--ozone-platform=` on the
command line wins over the default, and non-Linux platforms skip the second process entirely. The
switch goes in front of the original arguments because `parseCliArgs` drops the leading run of Electron
switches before it looks for a subcommand.

<!-- kk:related:start -->
# Related

- Related: [map-self-review-cli-invocations](/app/cli/map-self-review-cli-invocations.md)
<!-- kk:related:end -->
