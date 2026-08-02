---
type: practice
title: Limit file writes to the review XML and assets directory
description: >-
  App only writes the configured output XML file and a sibling
  .self-review-assets/ directory for image attachments.
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
At runtime the app writes the review XML at the configured `output-file` path (default `./review.xml`). When comments include image attachments, it also creates a `.self-review-assets/` directory alongside the output file containing the referenced images. No other files are written.

**Why:** Local-only, one-shot workflow with predictable on-disk side effects so users can reason about what the app touches.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
