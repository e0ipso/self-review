---
type: map
title: Knowledge node kinds and frontmatter
description: >-
  Leaves use type, description and kk-prefixed identity, provenance and edge
  fields.
tags:
  - knowledge-base
  - nodes
  - schema
kk_schema_version: 3
kk_id: map-knowledge-base-node-kinds-and-frontmatter
kk_derived_from:
  - .agents/skills/kk-curate/SKILL.md
kk_relates_to:
  - map-ai-knowledge-base-directory
kk_depends_on: []
kk_confidence: high
---
A knowledge leaf has YAML frontmatter with `type` (`practice` or `map`), `title`, `description`, `tags`, `kk_schema_version`, `kk_id`, `kk_derived_from`, `kk_relates_to`, `kk_depends_on` and `kk_confidence`, followed by a Markdown body. Practice owns operating rules; map owns named entities. Inspect `npx kenkeep schema node` for the current machine-readable contract. Placement is topical, independent of type.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-curate/SKILL.md](../../../../../.agents/skills/kk-curate/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-ai-knowledge-base-directory](map-ai-knowledge-base-directory.md)
<!-- kk:related:end -->
