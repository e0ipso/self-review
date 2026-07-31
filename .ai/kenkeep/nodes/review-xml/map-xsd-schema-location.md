---
type: map
title: XSD schema location
description: >-
  Single source of truth at
  .agents/skills/self-review-apply/assets/self-review-v2.xsd, mirrored under
  .opencode/ and embedded in packages/core/src/xml-serializer.ts.
tags:
  - task-manager
  - xsd
  - schema
kk_schema_version: 3
kk_id: map-xsd-schema-location
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to:
  - practice-keep-the-xsd-schema-in-sync-across-its-two-locations
kk_depends_on: []
kk_confidence: high
---
The XSD schema lives at `.agents/skills/self-review-apply/assets/self-review-v2.xsd`. This is the single source of truth for the XML output format.

Two further copies must track it: `.opencode/skills/self-review-apply/assets/self-review-v2.xsd` (harness mirror) and the `XSD_SCHEMA` string embedded in `packages/core/src/xml-serializer.ts` (used for runtime validation, since the skill assets are not packaged with the app). `packages/core/src/xsd-schema.test.ts` enforces that all three match.

The superseded `self-review-v1.xsd` is kept alongside at both on-disk locations, frozen, so consumers of v1 documents retain a validator.

<!-- kk:related:start -->
# Related

- Related: [practice-keep-the-xsd-schema-in-sync-across-its-two-locations](/review-xml/practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
