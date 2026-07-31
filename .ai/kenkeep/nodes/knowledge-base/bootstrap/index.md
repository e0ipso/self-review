# kenkeep Index: knowledge-base / bootstrap

↑ Parent: [knowledge-base](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Conclude bootstrap with a structured final report**](practice-conclude-bootstrap-with-a-structured-final-report.md) to learn about: After bootstrap, summarize docs read/skipped, node counts, collisions, unfollowed cross-references, suspect-stale docs, and index refresh. #knowledge-base #reporting
- Open [**Consolidate multi-source candidates into a single node with multiple \`derived_from\`**](practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from.md) to learn about: When the same convention appears in multiple docs, write one node and list all source paths in \`derived_from\`. #knowledge-base #deduplication
- Open [**Default node confidence to medium during bootstrap**](practice-default-node-confidence-to-medium-during-bootstrap.md) to learn about: Use \`confidence: medium\` for bootstrap content by default; reserve \`high\` for explicitly-stated, actively-maintained docs. #knowledge-base #confidence
- Open [**Defer file discovery to the CLI's bootstrap-incremental dry run**](practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md) to learn about: Use \`npx @e0ipso/ai-knowledge-base bootstrap-incremental --dry-run\` to list candidate files; do not rebuild discovery yourself. #knowledge-base #cli #discovery
- Open [**Honor \`bootstrapModel.name\` from KB config when delegating to sub-agents**](practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents.md) to learn about: If \`bootstrapModel.name\` is set in the KB config, pass it as the sub-agent's model; otherwise omit it so the sub-agent inherits its default. #knowledge-base #config #sub-agents
- Open [**Never auto-resolve contradictions during bootstrap**](practice-never-auto-resolve-contradictions-during-bootstrap.md) to learn about: If two docs disagree, write only one node and surface the conflict in your final report — do not write a second contradictory node. #knowledge-base #contradictions
- Open [**Never overwrite an existing node during bootstrap**](practice-never-overwrite-an-existing-node-during-bootstrap.md) to learn about: Bootstrap is conservative: if a target node file already exists, refine the title or skip the candidate and report it. #knowledge-base #node-authoring #collision
- Open [**Read entry points first, then sample and follow cross-references**](practice-read-entry-points-first-then-sample-and-follow-cross-references.md) to learn about: Read top-level entry points completely; sample other docs and follow inter-doc links rather than reading every file end-to-end. #knowledge-base #reading-strategy
- Open [**Run kb-bootstrap as a one-pass, supervised operation**](practice-run-kb-bootstrap-as-a-one-pass-supervised-operation.md) to learn about: Bootstrap is a one-time, supervised pass — work judgmentally by sampling and following cross-references, not exhaustively. #knowledge-base #bootstrap #workflow
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) to learn about: Bootstrap extracts what's already been written down — read only markdown docs, not source code. #knowledge-base #scope
- Open [**Stop and ask the user when bootstrap conditions go off-track**](practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track.md) to learn about: Pause and consult the user if docs exceed ~100 files, content is contentious/version-specific, you're over-extracting, or confidence drops without correction. #knowledge-base #escalation

## Components (what exists)
- Open [**CLI static skip list for bootstrap candidates**](map-cli-static-skip-list-for-bootstrap-candidates.md) to learn about: Pre-filter list of filenames the ai-knowledge-base CLI excludes from bootstrap candidates before the skill runs. #knowledge-base #cli #skip-list #bootstrap
- Open [**Default bootstrap scope**](map-default-bootstrap-scope.md) to learn about: With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files. #knowledge-base #scope
- Open [**kb-bootstrap skill**](map-kb-bootstrap-skill.md) to learn about: One-time, supervised skill that seeds the project knowledge base from existing markdown documentation. #knowledge-base #skill

## By topic

### #knowledge-base
- Open [**ai-knowledge-base CLI**](../tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**Default bootstrap scope**](map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
### #bootstrap
- Open [**CLI static skip list for bootstrap candidates**](map-cli-static-skip-list-for-bootstrap-candidates.md) — Pre-filter list of filenames the ai-knowledge-base CLI excludes from bootstrap candidates before the skill runs.
- Open [**Run kb-bootstrap as a one-pass, supervised operation**](practice-run-kb-bootstrap-as-a-one-pass-supervised-operation.md) — Bootstrap is a one-time, supervised pass — work judgmentally by sampling and following cross-references, not exhaustively.
### #cli
- Open [**ai-knowledge-base CLI**](../tooling/map-ai-knowledge-base-cli.md) — \`npx @e0ipso/ai-knowledge-base\` provides \`bootstrap-incremental\` and \`index rebuild\` subcommands used by kb-bootstrap.
- Open [**CLI static skip list**](../tooling/map-cli-static-skip-list.md) — The CLI pre-filters \`LICENSE\`, \`CHANGELOG\`, \`CODE_OF_CONDUCT\`, \`CONTRIBUTORS\`, \`INDEX.md\`, \`GRAPH.md\`, and \`releases/**/*.md\` from bootstrap candidates.
- Open [**Resolve the active KB harness and pass \`--harness "$HARNESS"\` to every CLI call**](../tooling/practice-resolve-the-active-kb-harness-and-pass-harness-harness-to-every-cli-call.md) — Detect the active harness via the kb-detect-harness script before running CLI commands, then pass \`--harness "$HARNESS"\` to each call.
### #scope
- Open [**Default bootstrap scope**](map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Skip files that look correct rather than forcing comments**](../../skills/critique/practice-skip-files-that-look-correct-rather-than-forcing-comments.md) — Critique should leave a file un-commented when nothing substantive is wrong; do not manufacture review comments on every file.
### #collision
- Open [**Never overwrite an existing node during bootstrap**](practice-never-overwrite-an-existing-node-during-bootstrap.md) — Bootstrap is conservative: if a target node file already exists, refine the title or skip the candidate and report it.
### #confidence
- Open [**Default node confidence to medium during bootstrap**](practice-default-node-confidence-to-medium-during-bootstrap.md) — Use \`confidence: medium\` for bootstrap content by default; reserve \`high\` for explicitly-stated, actively-maintained docs.
### #config
- Open [**Apply config precedence: CLI > project YAML > user YAML > defaults**](../../app/config/practice-apply-config-precedence-cli-project-yaml-user-yaml-defaults.md) — Higher-priority values override lower-priority values on a per-key shallow merge.
- Open [**Apply config precedence: project overrides user overrides defaults**](../../app/config/practice-apply-config-precedence-project-overrides-user-overrides-defaults.md) — \`.self-review.yaml\` overrides \`~/.config/self-review/config.yaml\`, which overrides built-in defaults.
- Open [**Knowledge base config locations**](../structure/map-knowledge-base-config-locations.md) — KB config is read from \`.ai/knowledge-base/config.yaml\`, with fallback to \`~/.config/ai-knowledge-base/config.yaml\`.
### #contradictions
- Open [**Never auto-resolve contradictions during bootstrap**](practice-never-auto-resolve-contradictions-during-bootstrap.md) — If two docs disagree, write only one node and surface the conflict in your final report — do not write a second contradictory node.
### #deduplication
- Open [**Consolidate multi-source candidates into a single node with multiple \`derived_from\`**](practice-consolidate-multi-source-candidates-into-a-single-node-with-multiple-derived-from.md) — When the same convention appears in multiple docs, write one node and list all source paths in \`derived_from\`.
### #discovery
- Open [**Defer file discovery to the CLI's bootstrap-incremental dry run**](practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md) — Use \`npx @e0ipso/ai-knowledge-base bootstrap-incremental --dry-run\` to list candidate files; do not rebuild discovery yourself.
- Open [**Detect sub-agents across .claude, .gemini, and .opencode directories**](../../planning/practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Sub-agent availability is determined by scanning the \`agents/\` subdirectory of each supported assistant directory.
### #escalation
- Open [**Stop and ask the user when bootstrap conditions go off-track**](practice-stop-and-ask-the-user-when-bootstrap-conditions-go-off-track.md) — Pause and consult the user if docs exceed ~100 files, content is contentious/version-specific, you're over-extracting, or confidence drops without correction.
### #node-authoring
- Open [**Don't hallucinate rationale in node bodies**](../structure/practice-don-t-hallucinate-rationale-in-node-bodies.md) — Only include "because…" content that is actually present in the source doc; do not generate plausible-sounding rationale.
- Open [**Never overwrite an existing node during bootstrap**](practice-never-overwrite-an-existing-node-during-bootstrap.md) — Bootstrap is conservative: if a target node file already exists, refine the title or skip the candidate and report it.
- Open [**Split combined content across practice and map nodes**](../structure/practice-split-combined-content-across-practice-and-map-nodes.md) — When content has both imperative and named-entity aspects, split it: practice owns the rule; map owns the definition.
### #reading-strategy
- Open [**Read entry points first, then sample and follow cross-references**](practice-read-entry-points-first-then-sample-and-follow-cross-references.md) — Read top-level entry points completely; sample other docs and follow inter-doc links rather than reading every file end-to-end.
### #reporting
- Open [**Conclude bootstrap with a structured final report**](practice-conclude-bootstrap-with-a-structured-final-report.md) — After bootstrap, summarize docs read/skipped, node counts, collisions, unfollowed cross-references, suspect-stale docs, and index refresh.
### #skill
- Open [**kb-bootstrap skill**](map-kb-bootstrap-skill.md) — One-time, supervised skill that seeds the project knowledge base from existing markdown documentation.
- Open [**self-review-apply assistant skill**](../../skills/apply/map-self-review-apply-assistant-skill.md) — Bundled AI assistant skill that reads review.xml and applies the feedback to the codebase.
### #skip-list
- Open [**CLI static skip list**](../tooling/map-cli-static-skip-list.md) — The CLI pre-filters \`LICENSE\`, \`CHANGELOG\`, \`CODE_OF_CONDUCT\`, \`CONTRIBUTORS\`, \`INDEX.md\`, \`GRAPH.md\`, and \`releases/**/*.md\` from bootstrap candidates.
- Open [**CLI static skip list for bootstrap candidates**](map-cli-static-skip-list-for-bootstrap-candidates.md) — Pre-filter list of filenames the ai-knowledge-base CLI excludes from bootstrap candidates before the skill runs.
### #sub-agents
- Open [**Honor \`bootstrapModel.name\` from KB config when delegating to sub-agents**](practice-honor-bootstrapmodel-name-from-kb-config-when-delegating-to-sub-agents.md) — If \`bootstrapModel.name\` is set in the KB config, pass it as the sub-agent's model; otherwise omit it so the sub-agent inherits its default.
### #workflow
- Open [**POST_PHASE hook**](../../planning/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../../planning/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Follow the allowed task status transitions**](../../planning/practice-follow-the-allowed-task-status-transitions.md) — Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress.