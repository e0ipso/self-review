---
schema_version: 1
id: map-knowledge-base-node-kinds-and-frontmatter
title: Knowledge-base node kinds and frontmatter
kind: map
tags:
  - knowledge-base
  - node
  - schema
derived_from:
  - .ai/knowledge-base/README.md
relates_to: []
confidence: high
summary: >-
  Nodes are practice (how we build) or map (what exists), with frontmatter
  including kind, tags, derived_from, relates_to, summary.
---
Each `.md` file under `.ai/knowledge-base/nodes/` has YAML frontmatter and a markdown body.

Key frontmatter fields:
- `kind`: `practice` (conventions, prohibitions, gotchas — how we build things) or `map` (features, vocabulary, locations — what exists in the project).
- `tags`: free-form labels, grouped under `## By topic` in `INDEX.md`.
- `derived_from`: list of session log filenames or doc paths that produced or refined the node.
- `relates_to`: cross-references rendered in `GRAPH.md`.
- `summary`: ≤140-character one-liner injected via `INDEX.md`.

Files live at `nodes/<kind>/<kind>-<slug>.md`.
