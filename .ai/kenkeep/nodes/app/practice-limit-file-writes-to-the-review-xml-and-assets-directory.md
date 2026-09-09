---
type: practice
title: Limit file writes to the review XML and assets directory
description: >-
  App writes only the output XML, a sibling .self-review-assets/ directory, and
  (remote mode) a temporary clone under the OS temp dir, removed on exit.
tags:
  - strikethroo
  - filesystem
  - scope
kk_schema_version: 3
kk_id: practice-limit-file-writes-to-the-review-xml-and-assets-directory
kk_derived_from:
  - AGENTS.md
kk_relates_to:
  - map-self-review
  - map-suggestion-apply-write-boundary
kk_depends_on: []
kk_confidence: high
---
At runtime the app writes the review XML at the configured `output-file` path (default `./review.xml`). When comments include image attachments, it also creates a `.self-review-assets/` directory alongside the output file containing the referenced images. In remote PR/MR mode without a matching local clone, it additionally creates a temporary blobless clone under the OS temp directory, removed on exit; when reusing an existing clone it only fetches into namespaced `refs/self-review/*` refs and never touches the working tree. There is exactly one sanctioned exception: the suggestion-apply path rewrites one reviewed working file, and only when the reviewer presses Apply on one suggestion. See the suggestion-apply write boundary for the pieces that bound it. Nothing else is written.

**Why:** Local-only, one-shot workflow with predictable on-disk side effects so users can reason about what the app touches.

<!-- kk:citations:start -->
# Citations

[1] [AGENTS.md](../../../../AGENTS.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-self-review](map-self-review.md)
<!-- kk:related:end -->
