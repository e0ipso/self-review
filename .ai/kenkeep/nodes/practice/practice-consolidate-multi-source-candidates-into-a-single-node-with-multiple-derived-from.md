---
schema_version: 1
id: >-
  practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from
title: >-
  Consolidate multi-source candidates into a single node with multiple
  `derived_from`
kind: practice
tags:
  - knowledge-base
  - deduplication
derived_from:
  - .cursor/skills/kb-bootstrap/SKILL.md
relates_to: []
confidence: high
summary: >-
  When the same convention appears in multiple docs, write one node and list all
  source paths in `derived_from`.
---
Do not produce duplicate nodes for the same rule. Instead, list every source doc that informed it in the `derived_from` array of a single node.

**Why:** Duplicates fragment the knowledge graph and waste reviewer attention. **How to apply:** When you spot a candidate you've already seen elsewhere, append the new source to the existing node instead of creating a new one.
