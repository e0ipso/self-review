---
type: map
title: XSD schema location
description: >-
  The canonical v3 XSD is under the apply skill and must remain byte-identical
  to the serializer's embedded XSD; the OpenCode path is a symlink.
tags:
  - self-review
  - xsd
  - schema
kk_schema_version: 3
kk_id: map-xsd-schema-location
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
  - AGENTS.md
kk_relates_to:
  - practice-keep-the-xsd-schema-in-sync-across-its-two-locations
kk_depends_on: []
kk_confidence: high
---
The live schema is `.agents/skills/self-review-apply/assets/self-review-v3.xsd`. The `XSD_SCHEMA` string embedded in `packages/core/src/xml-serializer.ts` is the second byte-identical copy used at runtime.

`.opencode/skills/self-review-apply` is a symlink to the real skill directory, not another copy. `packages/core/src/xsd-schema.test.ts` enforces the byte equality and the skill symlinks. `self-review-v1.xsd` and `self-review-v2.xsd` remain frozen for consumers of older documents; the current version (v3) may gain optional attributes additively, keeping every existing v3 document valid.

<!-- kk:related:start -->
# Related

- Related: [practice-keep-the-xsd-schema-in-sync-across-its-two-locations](/review-xml/practice-keep-the-xsd-schema-in-sync-across-its-two-locations.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
[2] [AGENTS.md](AGENTS.md)
<!-- kk:citations:end -->
