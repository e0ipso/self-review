---
type: practice
title: Validate XML output against the XSD before writing
description: >-
  Serializer must validate review output against the XSD; on failure, write to
  stderr and exit(1).
tags:
  - task-manager
  - xml
  - validation
kk_schema_version: 3
kk_id: practice-validate-xml-output-against-the-xsd-before-writing
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
The XML serializer validates output against the XSD schema before writing the file. If validation fails, the app writes an error to stderr and exits with code 1. Do not emit wrapper elements in the XML output (no `<files>`, no `<comments>` wrapper).

**Why:** The XML is consumed by downstream tools (`self-review-apply`); invalid output silently breaks the apply pipeline.

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
