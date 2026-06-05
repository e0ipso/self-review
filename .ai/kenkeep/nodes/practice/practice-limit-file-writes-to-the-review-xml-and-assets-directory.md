---
schema_version: 1
id: practice-limit-file-writes-to-the-review-xml-and-assets-directory
title: Limit file writes to the review XML and assets directory
kind: practice
tags:
  - task-manager
  - filesystem
  - scope
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  App only writes the configured output XML file and a sibling
  .self-review-assets/ directory for image attachments.
---
At runtime the app writes the review XML at the configured `output-file` path (default `./review.xml`). When comments include image attachments, it also creates a `.self-review-assets/` directory alongside the output file containing the referenced images. No other files are written.

**Why:** Local-only, one-shot workflow with predictable on-disk side effects so users can reason about what the app touches.
