# kenkeep Index: knowledge-base / bootstrap / workflow

↑ Parent: [bootstrap](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Report bootstrap writes and omissions**](practice-conclude-bootstrap-with-a-structured-final-report.md) to learn about: Report sources read, skipped candidates, node counts and index refresh. #knowledge-base #reporting
- Open [**Run bootstrap as a supervised pass**](practice-run-kb-bootstrap-as-a-one-pass-supervised-operation.md) to learn about: Sample source documentation and let the user review each new node. #knowledge-base #bootstrap #workflow
- Open [**Stop and ask the user when bootstrap conditions go off-track**](practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track.md) to learn about: Pause and consult the user if docs exceed ~100 files, content is contentious/version-specific, you're over-extracting, or confidence drops without correction. #knowledge-base #escalation
- Open [**Use documented configuration when drafting bootstrap nodes**](practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents.md) to learn about: Apply current project preferences and the shared delegation contract. #knowledge-base #config #subagents

## Components (what exists)
- Open [**kk-bootstrap skill**](map-kb-bootstrap-skill.md) to learn about: Supervised seeding from existing Markdown, with validated node writes. #knowledge-base #skills

## By topic

### #knowledge-base
- Open [**Kenkeep CLI**](../../tooling/map-ai-knowledge-base-cli.md) — Deterministic commands discover documents, validate schemas and maintain nodes.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](../discovery/map-default-bootstrap-scope.md) — Without a scope argument, finddocs scans from the repository root.
### #bootstrap
- Open [**Bootstrap document exclusions**](../discovery/map-cli-static-skip-list-for-bootstrap-candidates.md) — finddocs applies gitignore, kkignore and its static filename exclusions.
- Open [**Run bootstrap as a supervised pass**](practice-run-kb-bootstrap-as-a-one-pass-supervised-operation.md) — Sample source documentation and let the user review each new node.
### #config
- Open [**Apply config precedence: CLI > project YAML > user YAML > defaults**](../../../app/config/practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults.md) — Higher-priority values override lower-priority values on a per-key shallow merge.
- Open [**Apply config precedence: project overrides user overrides defaults**](../../../app/config/practice-apply-config-precedence-project-overrides-user-overrides-defaults.md) — \`.self-review.yaml\` overrides \`~/.config/self-review/config.yaml\`, which overrides built-in defaults.
- Open [**Knowledge base configuration**](../../structure/map-knowledge-base-config-locations.md) — Read project kenkeep configuration, with the user config fallback.
### #escalation
- Open [**Stop and ask the user when bootstrap conditions go off-track**](practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track.md) — Pause and consult the user if docs exceed ~100 files, content is contentious/version-specific, you're over-extracting, or confidence drops without correction.
### #reporting
- Open [**Report bootstrap writes and omissions**](practice-conclude-bootstrap-with-a-structured-final-report.md) — Report sources read, skipped candidates, node counts and index refresh.
### #skills
- Open [**Knowledge-base capture and curation workflow**](../../curate/map-knowledge-base-capture-curate-review-workflow.md) — Capture sessions, extract proposals, curate nodes and consume topical navigation.
- Open [**kk-bootstrap skill**](map-kb-bootstrap-skill.md) — Supervised seeding from existing Markdown, with validated node writes.
- Open [**self-review-critique skill**](../../../skills/critique/configuration/map-self-review-critique-skill.md) — Generate a guide and evidence-based review XML for local or remote diffs.
### #subagents
- Open [**Parallelize self-review application per file above a 3-file threshold**](../../../skills/apply/practice-parallelize-self-review-application-per-file-above-a-3-file-threshold.md) — For reviews with >3 commented files, spawn one subagent per file; for ≤3, apply changes directly.
- Open [**Use documented configuration when drafting bootstrap nodes**](practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents.md) — Apply current project preferences and the shared delegation contract.
### #workflow
- Open [**PRE_PLAN hook**](../../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../../../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**Knowledge-base capture and curation workflow**](../../curate/map-knowledge-base-capture-curate-review-workflow.md) — Capture sessions, extract proposals, curate nodes and consume topical navigation.