# kenkeep Index: knowledge-base / bootstrap / workflow

↑ Parent: [bootstrap](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Conclude bootstrap with a structured final report**](practice-conclude-bootstrap-with-a-structured-final-report.md) to learn about: After bootstrap, summarize docs read/skipped, node counts, collisions, unfollowed cross-references, suspect-stale docs, and index refresh. #knowledge-base #reporting
- Open [**Honor \`bootstrapModel.name\` from KB config when delegating to sub-agents**](practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents.md) to learn about: If \`bootstrapModel.name\` is set in the KB config, pass it as the sub-agent's model; otherwise omit it so the sub-agent inherits its default. #knowledge-base #config #sub-agents
- Open [**Run kb-bootstrap as a one-pass, supervised operation**](practice-run-kb-bootstrap-as-a-one-pass-supervised-operation.md) to learn about: Bootstrap is a one-time, supervised pass — work judgmentally by sampling and following cross-references, not exhaustively. #knowledge-base #bootstrap #workflow
- Open [**Stop and ask the user when bootstrap conditions go off-track**](practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track.md) to learn about: Pause and consult the user if docs exceed ~100 files, content is contentious/version-specific, you're over-extracting, or confidence drops without correction. #knowledge-base #escalation

## Components (what exists)
- Open [**kb-bootstrap skill**](map-kb-bootstrap-skill.md) to learn about: One-time, supervised skill that seeds the project knowledge base from existing markdown documentation. #knowledge-base #skill

## By topic

### #knowledge-base
- Open [**ai-knowledge-base CLI**](../../tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Default bootstrap scope**](../discovery/map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
### #bootstrap
- Open [**CLI static skip list for bootstrap candidates**](../discovery/map-cli-static-skip-list-for-bootstrap-candidates.md) — Pre-filter list of filenames the ai-knowledge-base CLI excludes from bootstrap candidates before the skill runs.
- Open [**Run kb-bootstrap as a one-pass, supervised operation**](practice-run-kb-bootstrap-as-a-one-pass-supervised-operation.md) — Bootstrap is a one-time, supervised pass — work judgmentally by sampling and following cross-references, not exhaustively.
### #config
- Open [**Apply config precedence: CLI > project YAML > user YAML > defaults**](../../../app/config/practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults.md) — Higher-priority values override lower-priority values on a per-key shallow merge.
- Open [**Apply config precedence: project overrides user overrides defaults**](../../../app/config/practice-apply-config-precedence-project-overrides-user-overrides-defaults.md) — \`.self-review.yaml\` overrides \`~/.config/self-review/config.yaml\`, which overrides built-in defaults.
- Open [**Knowledge base config locations**](../../structure/map-knowledge-base-config-locations.md) — KB config is read from \`.ai/knowledge-base/config.yaml\`, with fallback to \`~/.config/ai-knowledge-base/config.yaml\`.
### #escalation
- Open [**Stop and ask the user when bootstrap conditions go off-track**](practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track.md) — Pause and consult the user if docs exceed ~100 files, content is contentious/version-specific, you're over-extracting, or confidence drops without correction.
### #reporting
- Open [**Conclude bootstrap with a structured final report**](practice-conclude-bootstrap-with-a-structured-final-report.md) — After bootstrap, summarize docs read/skipped, node counts, collisions, unfollowed cross-references, suspect-stale docs, and index refresh.
### #skill
- Open [**kb-bootstrap skill**](map-kb-bootstrap-skill.md) — One-time, supervised skill that seeds the project knowledge base from existing markdown documentation.
- Open [**self-review-apply assistant skill**](../../../skills/apply/map-self-review-apply-assistant-skill.md) — Bundled assistant skill that validates v3 review.xml feedback, reads reply threads, and applies the accepted comments.
### #sub-agents
- Open [**Honor \`bootstrapModel.name\` from KB config when delegating to sub-agents**](practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents.md) — If \`bootstrapModel.name\` is set in the KB config, pass it as the sub-agent's model; otherwise omit it so the sub-agent inherits its default.
### #workflow
- Open [**POST_PHASE hook**](../../../planning/execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Follow the allowed task status transitions**](../../../planning/execution/practice-follow-the-allowed-task-status-transitions.md) — Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress.