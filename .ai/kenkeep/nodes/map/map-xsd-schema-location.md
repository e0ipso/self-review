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
relates_to:
  - practice-keep-the-xsd-schema-in-sync-across-its-two-locations
confidence: high
summary: >-
  Single source of truth at
  .agents/skills/self-review-apply/assets/self-review-v2.xsd, mirrored under
  .opencode/ and embedded in packages/core/src/xml-serializer.ts.
---
The XSD schema lives at `.agents/skills/self-review-apply/assets/self-review-v2.xsd`. This is the single source of truth for the XML output format.

Two further copies must track it: `.opencode/skills/self-review-apply/assets/self-review-v2.xsd` (harness mirror) and the `XSD_SCHEMA` string embedded in `packages/core/src/xml-serializer.ts` (used for runtime validation, since the skill assets are not packaged with the app). `packages/core/src/xsd-schema.test.ts` enforces that all three match.

The superseded `self-review-v1.xsd` is kept alongside at both on-disk locations, frozen, so consumers of v1 documents retain a validator.
