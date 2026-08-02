---
type: map
title: .ai/knowledge-base/ directory
description: >-
  AI-session-derived project knowledge base built and maintained by
  @e0ipso/ai-knowledge-base.
tags:
  - knowledge-base
  - structure
kk_schema_version: 3
kk_id: map-ai-knowledge-base-directory
kk_derived_from:
  - .ai/knowledge-base/README.md
kk_relates_to: []
kk_depends_on: []
kk_confidence: high
---
`.ai/knowledge-base/` holds the project's knowledge base in plain markdown, built and maintained by the [`@e0ipso/ai-knowledge-base`](https://github.com/e0ipso/ai-knowledge-base) tool.

Subdirectories:
- `nodes/`: knowledge nodes organized by kind (`practice/`, `map/`). Reviewed via git.
- `_sessions/`: raw captured transcripts (gitignored).
- `_logs/`: stream-json traces from LLM-driven runs (gitignored).
- `conflicts/`: one markdown file per curator-detected contradiction, surfaced by the kb-curate skill.
- `INDEX.md`: token-budgeted summary injected into every new session. Auto-regenerated on commit.
- `GRAPH.md`: full edge listing of nodes; read on demand by the harness. Auto-regenerated on commit.

<!-- kk:citations:start -->
# Citations

[1] [.ai/knowledge-base/README.md](.ai/knowledge-base/README.md)
<!-- kk:citations:end -->
