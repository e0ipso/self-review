---
type: practice
title: Encode diff header paths with quoteGitPath
description: >-
  quoteGitPath in synthetic-diff.ts reproduces git's C-style quoting and inverts
  decodeGitPath in diff-parser.ts.
tags:
  - git
  - diff
  - paths
  - encoding
kk_schema_version: 3
kk_id: practice-encode-diff-header-paths-with-quotegitpath
kk_derived_from: []
kk_relates_to:
  - practice-convert-git-diff-args-only-through-format-and-tokenize
kk_depends_on: []
kk_confidence: high
---
`quoteGitPath` in `packages/core/src/synthetic-diff.ts` writes a path the way git writes it in a diff
header: plain paths go out verbatim, anything with a control character, quote, backslash or non-ASCII
byte becomes a double-quoted C-style token. It is the exact inverse of the unexported `decodeGitPath` in
`diff-parser.ts`, and the pair has to stay that way. Without the encoder a filename containing a
newline ends the header line mid-name and the parser recovers a name no file answers to.

When checking the encoder against real git output, pin the config the comparison depends on:
`-c diff.mnemonicPrefix=false -c core.quotePath=true`. This environment sets `diff.mnemonicPrefix`, so
an unpinned parity check compares against `c/`/`i/`/`w/` prefixes and fails for the wrong reason.

<!-- kk:related:start -->
# Related

- Related: [practice-convert-git-diff-args-only-through-format-and-tokenize](/app/cli/practice-convert-git-diff-args-only-through-format-and-tokenize.md)
<!-- kk:related:end -->
