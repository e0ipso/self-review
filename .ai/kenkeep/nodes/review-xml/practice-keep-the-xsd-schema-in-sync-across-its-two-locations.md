---
type: practice
title: Keep the XSD schema in sync across its three locations
description: >-
  Schema lives at .agents/ and .opencode/ skill assets plus an embedded string
  in packages/core/src/xml-serializer.ts; a unit test enforces all three match.
tags:
  - task-manager
  - xsd
  - sync
kk_schema_version: 3
kk_id: practice-keep-the-xsd-schema-in-sync-across-its-two-locations
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
kk_relates_to:
  - map-xsd-schema-location
kk_depends_on: []
kk_confidence: high
---
The XSD schema exists in three places, all of which must be byte-identical: `.agents/skills/self-review-apply/assets/self-review-v2.xsd`, `.opencode/skills/self-review-apply/assets/self-review-v2.xsd`, and the `XSD_SCHEMA` string embedded in `packages/core/src/xml-serializer.ts`.

Do not rely on remembering this. `packages/core/src/xsd-schema.test.ts` compares all three and fails the unit suite if any one drifts, and the embedded string is generated from the on-disk file verbatim so the comparison is exact rather than normalized.

`self-review-v1.xsd` remains at both on-disk locations, frozen. It is there so consumers holding v1 documents keep a validator, and it must not be edited.

**Why:** The standalone copies are the source of truth for the skills and for external consumers that vendor the schema; the embedded copy is what the serializer actually validates against at runtime. The copies were previously undocumented and unenforced, and the prose describing them went stale through a package move without anything noticing.

<!-- kk:related:start -->
# Related

- Related: [map-xsd-schema-location](/review-xml/map-xsd-schema-location.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
<!-- kk:citations:end -->
