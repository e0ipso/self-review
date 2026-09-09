---
type: practice
title: Convert git diff args only through format/tokenize
description: >-
  formatGitDiffArgs and tokenizeGitDiffArgs are the sanctioned argv-to-string
  conversion in both directions.
tags:
  - cli
  - git
  - review-xml
  - round-trip
kk_schema_version: 3
kk_id: practice-convert-git-diff-args-only-through-format-and-tokenize
kk_derived_from: []
kk_relates_to:
  - map-review-xml-format-and-xsd
  - map-self-review-cli-invocations
kk_depends_on: []
kk_confidence: high
---
`packages/core/src/git-diff-args.ts` owns both directions of the conversion between an argv array and
the single string a git diff source carries. `tokenizeGitDiffArgs` parses it (also used for
`default-diff-args` from YAML, which people write with shell quoting), and `formatGitDiffArgs` writes
it. Do not hand-roll a `split(' ')` or a `join(' ')` at a call site.

`formatGitDiffArgs` quotes only arguments that would not survive a bare round trip, so ordinary
invocations render byte-identically to a plain join. That is deliberate: the `git-diff-args` attribute
is public in the review XML, and existing documents must keep their exact shape. Tokenizing is
tolerant by design. An unterminated quote closes at end of input rather than throwing, so a broken
config line degrades to a best-effort argument list instead of taking startup down.

<!-- kk:related:start -->
# Related

- Related: [map-review-xml-format-and-xsd](/review-xml/schema/map-review-xml-format-and-xsd.md)
- Related: [map-self-review-cli-invocations](/app/cli/map-self-review-cli-invocations.md)
<!-- kk:related:end -->
