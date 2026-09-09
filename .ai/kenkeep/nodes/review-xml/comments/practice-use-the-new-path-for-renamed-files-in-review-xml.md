---
type: practice
title: Use the new path for renamed files in review XML
description: >-
  For change-type="renamed" entries, the path attribute carries the new path,
  not the original path.
tags:
  - self-review
  - xml
  - renames
kk_schema_version: 3
kk_id: practice-use-the-new-path-for-renamed-files-in-review-xml
kk_derived_from:
  - .agents/skills/self-review-critique/SKILL.md
kk_relates_to:
  - map-review-xml-format-and-xsd
kk_depends_on: []
kk_confidence: high
---
When a file is renamed (`change-type="renamed"`), the `path` attribute on `<file>` must be the new path. Read the file at its new path when gathering context for the critique.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/self-review-critique/SKILL.md](../../../../../.agents/skills/self-review-critique/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [map-review-xml-format-and-xsd](../schema/map-review-xml-format-and-xsd.md)
<!-- kk:related:end -->
