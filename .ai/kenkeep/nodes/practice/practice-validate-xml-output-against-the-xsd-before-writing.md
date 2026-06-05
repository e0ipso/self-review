---
schema_version: 1
id: practice-validate-xml-output-against-the-xsd-before-writing
title: Validate XML output against the XSD before writing
kind: practice
tags:
  - task-manager
  - xml
  - validation
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Serializer must validate review output against the XSD; on failure, write to
  stderr and exit(1).
---
The XML serializer validates output against the XSD schema before writing the file. If validation fails, the app writes an error to stderr and exits with code 1. Do not emit wrapper elements in the XML output (no `<files>`, no `<comments>` wrapper).

**Why:** The XML is consumed by downstream tools (`self-review-apply`); invalid output silently breaks the apply pipeline.
