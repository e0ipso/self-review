# kenkeep Index: planning / assignment

↑ Parent: [planning](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Discover agents through the active harness**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) to learn about: Use the current harness agents directory, with general-purpose fallback. #agents #discovery #conventions
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) to learn about: Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment. #task-assignment #skills #assistant-skills
- Open [**Match task skills to sub-agents during PRE_TASK_ASSIGNMENT**](practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md) to learn about: Read task frontmatter skills and select the most appropriate sub-agent; fall back to a general-purpose agent when none matches. #task-assignment #agents #hooks

## Components (what exists)
- Open [**PRE_TASK_ASSIGNMENT hook**](map-pre-task-assignment-hook.md) to learn about: Match task skills and domain to available agents in the active harness. #hooks #strikethroo #ai
- Open [**Task skill extraction in PRE_TASK_ASSIGNMENT**](map-extract-task-skills-cjs.md) to learn about: Read the task YAML skills array directly; no helper script is required. #scripts #strikethroo #skills

## By topic

### #agents
- Open [**Discover agents through the active harness**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Use the current harness agents directory, with general-purpose fallback.
- Open [**Match task skills to sub-agents during PRE_TASK_ASSIGNMENT**](practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md) — Read task frontmatter skills and select the most appropriate sub-agent; fall back to a general-purpose agent when none matches.
### #hooks
- Open [**PRE_PLAN hook**](../authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**PRE_TASK_ASSIGNMENT hook**](map-pre-task-assignment-hook.md) — Match task skills and domain to available agents in the active harness.
### #skills
- Open [**Knowledge-base capture and curation workflow**](../../knowledge-base/curate/map-knowledge-base-capture-curate-review-workflow.md) — Capture sessions, extract proposals, curate nodes and consume topical navigation.
- Open [**kk-bootstrap skill**](../../knowledge-base/bootstrap/workflow/map-kb-bootstrap-skill.md) — Supervised seeding from existing Markdown, with validated node writes.
- Open [**self-review-critique skill**](../../skills/critique/configuration/map-self-review-critique-skill.md) — Generate a guide and evidence-based review XML for local or remote diffs.
### #strikethroo
- Open [**PRE_PLAN hook**](../authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**POST_PLAN hook**](../authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
### #task-assignment
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) — Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment.
- Open [**Match task skills to sub-agents during PRE_TASK_ASSIGNMENT**](practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md) — Read task frontmatter skills and select the most appropriate sub-agent; fall back to a general-purpose agent when none matches.
### #ai
- Open [**PRE_TASK_ASSIGNMENT hook**](map-pre-task-assignment-hook.md) — Match task skills and domain to available agents in the active harness.
- Open [**Design XML output to be parsed by LLMs**](../../review-xml/schema/practice-design-xml-output-to-be-parsed-by-llms.md) — Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback.
- Open [**self-review-apply assistant skill**](../../skills/apply/map-self-review-apply-assistant-skill.md) — Bundled assistant skill that validates v3 review.xml feedback, reads reply threads, and applies the accepted comments.
### #assistant-skills
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) — Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment.
### #conventions
- Open [**Discover agents through the active harness**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Use the current harness agents directory, with general-purpose fallback.
### #discovery
- Open [**Discover agents through the active harness**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Use the current harness agents directory, with general-purpose fallback.
- Open [**Discover bootstrap documents through finddocs**](../../knowledge-base/bootstrap/discovery/practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md) — Use finddocs with hashes and compare prior bootstrap state before reading.
### #scripts
- Open [**Task skill extraction in PRE_TASK_ASSIGNMENT**](map-extract-task-skills-cjs.md) — Read the task YAML skills array directly; no helper script is required.