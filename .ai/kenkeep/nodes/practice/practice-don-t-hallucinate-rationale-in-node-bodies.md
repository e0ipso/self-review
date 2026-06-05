---
schema_version: 1
id: practice-don-t-hallucinate-rationale-in-node-bodies
title: Don't hallucinate rationale in node bodies
kind: practice
tags:
  - knowledge-base
  - node-authoring
  - rationale
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  Only include "because…" content that is actually present in the source doc; do
  not generate plausible-sounding rationale.
---
If the doc just says "use X," your node says "use X" — not "use X because of [made-up reason]." Quote or close-paraphrase rationale from the source only.

**Why:** Fabricated rationale poisons the knowledge base with confident-sounding falsehoods. **How to apply:** When rationale is absent from the source, leave it out of the node body.
