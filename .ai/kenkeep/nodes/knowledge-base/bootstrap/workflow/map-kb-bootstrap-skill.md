---
type: map
title: kk-bootstrap skill
description: >-
  Supervised seeding from existing Markdown, with validated node writes.
tags:
  - knowledge-base
  - skills
kk_schema_version: 3
kk_id: map-kb-bootstrap-skill
kk_derived_from:
  - .agents/skills/kk-bootstrap/SKILL.md
kk_relates_to:
  - practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from
  - practice-default-node-confidence-to-medium-during-bootstrap
  - practice-never-auto-resolve-contradictions-during-bootstrap
  - practice-never-overwrite-an-existing-node-during-bootstrap
  - map-cli-static-skip-list-for-bootstrap-candidates
  - map-default-bootstrap-scope
  - practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run
  - practice-read-entry-points-first-then-sample-and-follow-cross-references
  - practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap
  - practice-conclude-bootstrap-with-a-structured-final-report
  - practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents
  - practice-run-kb-bootstrap-as-a-one-pass-supervised-operation
  - practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track
  - map-knowledge-base-capture-curate-review-workflow
kk_depends_on: []
kk_confidence: high
---
`kk-bootstrap` surveys existing Markdown using `finddocs`, skips documents already recorded at the same hash, and drafts new practice or map nodes. Persist through `node write`, then rebuild navigation. Skip overlap with existing nodes. The user reviews the files, accepts by leaving them and rejects by deleting them.

<!-- kk:citations:start -->
# Citations

[1] [.agents/skills/kk-bootstrap/SKILL.md](../../../../../../.agents/skills/kk-bootstrap/SKILL.md)
<!-- kk:citations:end -->

<!-- kk:related:start -->
# Related

- Related: [practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from](../admission/practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from.md)
- Related: [practice-default-node-confidence-to-medium-during-bootstrap](../admission/practice-default-node-confidence-to-medium-during-bootstrap.md)
- Related: [practice-never-auto-resolve-contradictions-during-bootstrap](../admission/practice-never-auto-resolve-contradictions-during-bootstrap.md)
- Related: [practice-never-overwrite-an-existing-node-during-bootstrap](../admission/practice-never-overwrite-an-existing-node-during-bootstrap.md)
- Related: [map-cli-static-skip-list-for-bootstrap-candidates](../discovery/map-cli-static-skip-list-for-bootstrap-candidates.md)
- Related: [map-default-bootstrap-scope](../discovery/map-default-bootstrap-scope.md)
- Related: [practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run](../discovery/practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md)
- Related: [practice-read-entry-points-first-then-sample-and-follow-cross-references](../discovery/practice-read-entry-points-first-then-sample-and-follow-cross-references.md)
- Related: [practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap](../discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md)
- Related: [practice-conclude-bootstrap-with-a-structured-final-report](practice-conclude-bootstrap-with-a-structured-final-report.md)
- Related: [practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents](practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents.md)
- Related: [practice-run-kb-bootstrap-as-a-one-pass-supervised-operation](practice-run-kb-bootstrap-as-a-one-pass-supervised-operation.md)
- Related: [practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track](practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track.md)
- Related: [map-knowledge-base-capture-curate-review-workflow](../../curate/map-knowledge-base-capture-curate-review-workflow.md)
<!-- kk:related:end -->
