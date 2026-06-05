---
schema_version: 1
id: map-xsd-schema-location
title: XSD schema location
kind: map
tags:
  - task-manager
  - xsd
  - schema
derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
relates_to: []
confidence: high
summary: >-
  Single source of truth at
  .agents/skills/self-review-apply/assets/self-review-v1.xsd, mirrored in
  xml-serializer.ts.
---
The XSD schema lives at `.agents/skills/self-review-apply/assets/self-review-v1.xsd`. This is the single source of truth for the XML output format. A copy is also embedded as a string in `src/main/xml-serializer.ts` for runtime validation; the two must stay in sync.
