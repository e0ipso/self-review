---
type: practice
title: Keep the v3 XSD schema in sync across its two locations
description: >-
  Keep the canonical v3 XSD and the serializer's embedded XSD byte-identical,
  and preserve the OpenCode skill symlinks.
tags:
  - self-review
  - xsd
  - sync
kk_schema_version: 3
kk_id: practice-keep-the-xsd-schema-in-sync-across-its-two-locations
kk_derived_from:
  - .ai/task-manager/config/TASK_MANAGER.md
  - AGENTS.md
kk_relates_to:
  - map-xsd-schema-location
kk_depends_on: []
kk_confidence: high
---
Keep `.agents/skills/self-review-apply/assets/self-review-v3.xsd` byte-identical to the `XSD_SCHEMA` string embedded in `packages/core/src/xml-serializer.ts`. The on-disk schema serves skills and external consumers; the embedded string is what runtime serialization validates against.

Do not replace `.opencode/skills/self-review-apply` or `.opencode/skills/self-review-critique` with copies: they are symlinks into `.agents/skills/`. `packages/core/src/xsd-schema.test.ts` enforces both the byte equality and the symlink invariant. `self-review-v1.xsd` and `self-review-v2.xsd` are frozen and must not be edited; the current version (v3) may gain optional attributes additively (both copies amended together), so every previously valid v3 document remains valid.

<!-- kk:related:start -->
# Related

- Related: [map-xsd-schema-location](/review-xml/map-xsd-schema-location.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [.ai/task-manager/config/TASK_MANAGER.md](.ai/task-manager/config/TASK_MANAGER.md)
[2] [AGENTS.md](AGENTS.md)
<!-- kk:citations:end -->
