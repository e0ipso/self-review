---
type: practice
title: Limit file writes to the review XML and assets directory
description: >-
  App writes only the output XML, a sibling .self-review-assets/ directory,
  and (remote mode) a temporary clone under the OS temp dir, removed on exit.
tags:
  - task-manager
  - filesystem
  - scope
kk_schema_version: 3
kk_id: practice-limit-file-writes-to-the-review-xml-and-assets-directory
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
At runtime the app writes the review XML at the configured `output-file` path (default `./review.xml`). When comments include image attachments, it also creates a `.self-review-assets/` directory alongside the output file containing the referenced images. In remote PR/MR mode without a matching local clone, it additionally creates a temporary blobless clone under the OS temp directory, removed on exit; when reusing an existing clone it only fetches into namespaced `refs/self-review/*` refs and never touches the working tree. No other files are written.

**Why:** Local-only, one-shot workflow with predictable on-disk side effects so users can reason about what the app touches.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
