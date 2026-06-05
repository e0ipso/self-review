---
schema_version: 1
id: practice-keep-the-xsd-schema-in-sync-across-its-two-locations
title: Keep the XSD schema in sync across its two locations
kind: practice
tags:
  - task-manager
  - xsd
  - sync
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Schema lives at .agents/skills/self-review-apply/assets/self-review-v1.xsd and
  embedded in xml-serializer.ts; update both.
---
The XSD schema exists in two locations: `.agents/skills/self-review-apply/assets/self-review-v1.xsd` (standalone) and embedded as a string in `src/main/xml-serializer.ts`. Both copies must be kept in sync when the schema changes.

**Why:** The standalone copy is the source of truth for downstream skills; the embedded copy is what the serializer actually validates against at runtime.
