---
schema_version: 1
id: map-knowledge-base-directory-layout-under-ai-knowledge-base
title: Knowledge-base directory layout under .ai/knowledge-base/
kind: map
tags:
  - kb
  - layout
  - paths
derived_from:
  - .cursor/skills/kb-curate/SKILL.md
relates_to: []
confidence: high
summary: >-
  Nodes live in nodes/<kind>/, conflicts in conflicts/<id>.md, curator state in
  .state/state.json, indexes are INDEX.md/GRAPH.md.
---
The project knowledge base lives under `.ai/knowledge-base/` with these locations:

- `nodes/<kind>/` — node files written directly by the curator for `add` and `modify` actions.
- `conflicts/<id>.md` — one markdown file per `contradict` action; frontmatter exposes `id`, `status`, `target_node_id`, `proposed_kind`, `proposed_title`, `proposed_confidence`, `candidate_origin`, `run_id`, `detected_at`; body has `## Rationale` and `## Proposed node` sections.
- `.state/state.json` — curator lock (name=`curator`, PID + 30-min TTL).
- `INDEX.md` / `GRAPH.md` — regenerated from the `nodes/` tree at end of every curate run.
- `config.yaml` — may set `cliDefaultHarness` for harness resolution.
