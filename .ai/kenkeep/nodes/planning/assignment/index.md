# kenkeep Index: planning / assignment

↑ Parent: [planning](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Detect sub-agents across .claude, .gemini, and .opencode directories**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) to learn about: Sub-agent availability is determined by scanning the \`agents/\` subdirectory of each supported assistant directory. #agents #discovery #conventions
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) to learn about: Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment. #task-assignment #skills #assistant-skills
- Open [**Match task skills to sub-agents during PRE_TASK_ASSIGNMENT**](practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md) to learn about: Read task frontmatter skills and select the most appropriate sub-agent; fall back to a general-purpose agent when none matches. #task-assignment #agents #hooks

## Components (what exists)
- Open [**extract-task-skills.cjs**](map-extract-task-skills-cjs.md) to learn about: Helper script that extracts the \`skills\` array from a task file's frontmatter. #scripts #task-manager #skills
- Open [**PRE_TASK_ASSIGNMENT hook**](map-pre-task-assignment-hook.md) to learn about: Hook that runs before task assignment to select an appropriate agent for each task based on required skills. #hooks #task-manager #ai

## By topic

### #agents
- Open [**Detect sub-agents across .claude, .gemini, and .opencode directories**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Sub-agent availability is determined by scanning the \`agents/\` subdirectory of each supported assistant directory.
- Open [**Match task skills to sub-agents during PRE_TASK_ASSIGNMENT**](practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md) — Read task frontmatter skills and select the most appropriate sub-agent; fall back to a general-purpose agent when none matches.
### #hooks
- Open [**PRE_TASK_ASSIGNMENT hook**](map-pre-task-assignment-hook.md) — Hook that runs before task assignment to select an appropriate agent for each task based on required skills.
- Open [**POST_PLAN hook**](../authoring/map-post-plan-hook.md) — Task-manager hook at .ai/task-manager/config/hooks/POST_PLAN.md that gates plans on PRD/test updates and architecture review.
- Open [**Do not hand-edit INDEX.md or GRAPH.md**](../../knowledge-base/structure/practice-do-not-hand-edit-index-md-or-graph-md.md) — Both files are regenerated automatically by the lint-staged pre-commit hook and staged into the commit.
### #skills
- Open [**self-review-apply skill**](../../skills/apply/map-self-review-apply-skill.md) — Slash command that consumes a v3 review.xml, reads threaded replies in order, and applies accepted feedback to the codebase.
- Open [**self-review-critique skill**](../../skills/critique/configuration/map-self-review-critique-skill.md) — Slash command that critiques a git diff and emits review.xml for human validation via self-review --resume-from.
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) — Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment.
### #task-assignment
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) — Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment.
- Open [**Match task skills to sub-agents during PRE_TASK_ASSIGNMENT**](practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md) — Read task frontmatter skills and select the most appropriate sub-agent; fall back to a general-purpose agent when none matches.
### #task-manager
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #ai
- Open [**Design XML output to be parsed by LLMs**](../../review-xml/schema/practice-design-xml-output-to-be-parsed-by-llms.md) — Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback.
- Open [**PRE_TASK_ASSIGNMENT hook**](map-pre-task-assignment-hook.md) — Hook that runs before task assignment to select an appropriate agent for each task based on required skills.
- Open [**self-review-apply assistant skill**](../../skills/apply/map-self-review-apply-assistant-skill.md) — Bundled assistant skill that validates v3 review.xml feedback, reads reply threads, and applies the accepted comments.
### #assistant-skills
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) — Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment.
### #conventions
- Open [**Detect sub-agents across .claude, .gemini, and .opencode directories**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Sub-agent availability is determined by scanning the \`agents/\` subdirectory of each supported assistant directory.
### #discovery
- Open [**Defer file discovery to the CLI's bootstrap-incremental dry run**](../../knowledge-base/bootstrap/discovery/practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md) — Use \`npx @e0ipso/ai-knowledge-base bootstrap-incremental --dry-run\` to list candidate files; do not rebuild discovery yourself.
- Open [**Detect sub-agents across .claude, .gemini, and .opencode directories**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Sub-agent availability is determined by scanning the \`agents/\` subdirectory of each supported assistant directory.
### #scripts
- Open [**extract-task-skills.cjs**](map-extract-task-skills-cjs.md) — Helper script that extracts the \`skills\` array from a task file's frontmatter.