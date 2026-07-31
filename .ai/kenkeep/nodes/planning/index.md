# kenkeep Index: planning

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) to learn about: After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document. #task-management #blueprint #dependencies
- Open [**Check plans for architecture and code reuse improvements**](practice-check-plans-for-architecture-and-code-reuse-improvements.md) to learn about: Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing. #planning #architecture #code-reuse
- Open [**Detect sub-agents across .claude, .gemini, and .opencode directories**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) to learn about: Sub-agent availability is determined by scanning the \`agents/\` subdirectory of each supported assistant directory. #agents #discovery #conventions
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) to learn about: Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment. #task-assignment #skills #assistant-skills
- Open [**Follow the allowed task status transitions**](practice-follow-the-allowed-task-status-transitions.md) to learn about: Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress. #workflow #task-status
- Open [**Mark completed phases and tasks in the blueprint before advancing**](practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing.md) to learn about: After validating a phase, update the blueprint: ✅ in front of the phase title, ✔️ in front of each task, and set task status to completed. #workflow #progress-tracking #blueprint
- Open [**Match task skills to sub-agents during PRE_TASK_ASSIGNMENT**](practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md) to learn about: Read task frontmatter skills and select the most appropriate sub-agent; fall back to a general-purpose agent when none matches. #task-assignment #agents #hooks
- Open [**Pass linting and create a descriptive conventional commit at the end of each phase**](practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase.md) to learn about: Before moving to the next phase, ensure linting passes and a conventional-commit (subject + description) is created for the phase. #workflow #linting #commits
- Open [**Review every generated task for complexity, vagueness, and triviality**](practice-review-every-generated-task-for-complexity-vagueness-and-triviality.md) to learn about: After task generation, split tasks spanning 3+ technologies/skills, sharpen vague acceptance criteria, and merge trivial tasks. #task-management #planning #quality
- Open [**Review plans against PRD and test/features updates**](practice-review-plans-against-prd-and-test-features-updates.md) to learn about: After producing a plan, confirm whether PRD.md and test/features need updates, keeping additions succinct and skipping them for minimal changes. #planning #prd #tests
- Open [**Write PRDs without tasks or phases during plan creation**](practice-write-prds-without-tasks-or-phases-during-plan-creation.md) to learn about: Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step. #planning #prd #workflow

## Components (what exists)
- Open [**extract-task-skills.cjs**](map-extract-task-skills-cjs.md) to learn about: Helper script that extracts the \`skills\` array from a task file's frontmatter. #scripts #task-manager #skills
- Open [**POST_PHASE hook**](map-post-phase-hook.md) to learn about: Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates. #hook #workflow #task-manager
- Open [**POST_PLAN hook**](map-post-plan-hook.md) to learn about: Task-manager hook at .ai/task-manager/config/hooks/POST_PLAN.md that gates plans on PRD/test updates and architecture review. #hooks #task-manager #planning
- Open [**POST_TASK_GENERATION_ALL hook**](map-post-task-generation-all-hook.md) to learn about: Lifecycle hook that runs after all tasks are generated to review complexity and append a blueprint to the plan. #task-management #hooks #lifecycle
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) to learn about: Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation. #task-manager #hook #workflow
- Open [**PRE_TASK_ASSIGNMENT hook**](map-pre-task-assignment-hook.md) to learn about: Hook that runs before task assignment to select an appropriate agent for each task based on required skills. #hooks #task-manager #ai

## By topic

### #workflow
- Open [**POST_PHASE hook**](map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Follow the allowed task status transitions**](practice-follow-the-allowed-task-status-transitions.md) — Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress.
### #planning
- Open [**Review plans against PRD and test/features updates**](practice-review-plans-against-prd-and-test-features-updates.md) — After producing a plan, confirm whether PRD.md and test/features need updates, keeping additions succinct and skipping them for minimal changes.
- Open [**Write PRDs without tasks or phases during plan creation**](practice-write-prds-without-tasks-or-phases-during-plan-creation.md) — Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step.
- Open [**Check plans for architecture and code reuse improvements**](practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing.
### #task-manager
- Open [**POST_PHASE hook**](map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #hooks
- Open [**POST_PLAN hook**](map-post-plan-hook.md) — Task-manager hook at .ai/task-manager/config/hooks/POST_PLAN.md that gates plans on PRD/test updates and architecture review.
- Open [**PRE_TASK_ASSIGNMENT hook**](map-pre-task-assignment-hook.md) — Hook that runs before task assignment to select an appropriate agent for each task based on required skills.
- Open [**Do not hand-edit INDEX.md or GRAPH.md**](../knowledge-base/structure/practice-do-not-hand-edit-index-md-or-graph-md.md) — Both files are regenerated automatically by the lint-staged pre-commit hook and staged into the commit.
### #task-management
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**POST_TASK_GENERATION_ALL hook**](map-post-task-generation-all-hook.md) — Lifecycle hook that runs after all tasks are generated to review complexity and append a blueprint to the plan.
- Open [**Review every generated task for complexity, vagueness, and triviality**](practice-review-every-generated-task-for-complexity-vagueness-and-triviality.md) — After task generation, split tasks spanning 3+ technologies/skills, sharpen vague acceptance criteria, and merge trivial tasks.
### #agents
- Open [**Detect sub-agents across .claude, .gemini, and .opencode directories**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Sub-agent availability is determined by scanning the \`agents/\` subdirectory of each supported assistant directory.
- Open [**Match task skills to sub-agents during PRE_TASK_ASSIGNMENT**](practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md) — Read task frontmatter skills and select the most appropriate sub-agent; fall back to a general-purpose agent when none matches.
### #blueprint
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**Mark completed phases and tasks in the blueprint before advancing**](practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing.md) — After validating a phase, update the blueprint: ✅ in front of the phase title, ✔️ in front of each task, and set task status to completed.
### #hook
- Open [**POST_PHASE hook**](map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
### #prd
- Open [**Review plans against PRD and test/features updates**](practice-review-plans-against-prd-and-test-features-updates.md) — After producing a plan, confirm whether PRD.md and test/features need updates, keeping additions succinct and skipping them for minimal changes.
- Open [**Write PRDs without tasks or phases during plan creation**](practice-write-prds-without-tasks-or-phases-during-plan-creation.md) — Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step.
### #skills
- Open [**self-review-apply skill**](../skills/apply/map-self-review-apply-skill.md) — Slash command that consumes a review.xml file and applies its suggestions/comments to the codebase.
- Open [**self-review-critique skill**](../skills/critique/map-self-review-critique-skill.md) — Slash command that critiques a git diff and emits review.xml for human validation via self-review --resume-from.
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) — Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment.
### #task-assignment
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) — Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment.
- Open [**Match task skills to sub-agents during PRE_TASK_ASSIGNMENT**](practice-match-task-skills-to-sub-agents-during-pre-task-assignment.md) — Read task frontmatter skills and select the most appropriate sub-agent; fall back to a general-purpose agent when none matches.
### #ai
- Open [**Design XML output to be parsed by LLMs**](../review-xml/practice-design-xml-output-to-be-parsed-by-llms.md) — Review output is structured XML with an XSD schema so LLMs can reliably parse and act on feedback.
- Open [**PRE_TASK_ASSIGNMENT hook**](map-pre-task-assignment-hook.md) — Hook that runs before task assignment to select an appropriate agent for each task based on required skills.
- Open [**self-review-apply assistant skill**](../skills/apply/map-self-review-apply-assistant-skill.md) — Bundled AI assistant skill that reads review.xml and applies the feedback to the codebase.
### #architecture
- Open [**Check plans for architecture and code reuse improvements**](practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing.
- Open [**Do not import sibling packages from @self-review/types**](../packages/practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
- Open [**Two-process Electron architecture**](../app/architecture/map-two-process-electron-architecture.md) — Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge.
### #assistant-skills
- Open [**Engage relevant assistant skills based on task skills**](practice-engage-relevant-assistant-skills-based-on-task-skills.md) — Analyze the set of task skills to engage any relevant assistant skills (global or project) during task assignment.
### #code-reuse
- Open [**Check plans for architecture and code reuse improvements**](practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing.
- Open [**Extract shared logic before duplicating across call sites**](../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #commits
- Open [**Pass linting and create a descriptive conventional commit at the end of each phase**](practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase.md) — Before moving to the next phase, ensure linting passes and a conventional-commit (subject + description) is created for the phase.
### #conventions
- Open [**Detect sub-agents across .claude, .gemini, and .opencode directories**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Sub-agent availability is determined by scanning the \`agents/\` subdirectory of each supported assistant directory.
### #dependencies
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**Do not add Tailwind as a peer dependency for host apps**](../packages/practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) — tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind.
- Open [**Keep @self-review/types free of runtime dependencies**](../packages/practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
### #discovery
- Open [**Defer file discovery to the CLI's bootstrap-incremental dry run**](../knowledge-base/bootstrap/practice-defer-file-discovery-to-the-cli-s-bootstrap-incremental-dry-run.md) — Use \`npx @e0ipso/ai-knowledge-base bootstrap-incremental --dry-run\` to list candidate files; do not rebuild discovery yourself.
- Open [**Detect sub-agents across .claude, .gemini, and .opencode directories**](practice-detect-sub-agents-across-claude-gemini-and-opencode-directories.md) — Sub-agent availability is determined by scanning the \`agents/\` subdirectory of each supported assistant directory.
### #lifecycle
- Open [**POST_TASK_GENERATION_ALL hook**](map-post-task-generation-all-hook.md) — Lifecycle hook that runs after all tasks are generated to review complexity and append a blueprint to the plan.
### #linting
- Open [**Pass linting and create a descriptive conventional commit at the end of each phase**](practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase.md) — Before moving to the next phase, ensure linting passes and a conventional-commit (subject + description) is created for the phase.
### #progress-tracking
- Open [**Mark completed phases and tasks in the blueprint before advancing**](practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing.md) — After validating a phase, update the blueprint: ✅ in front of the phase title, ✔️ in front of each task, and set task status to completed.
### #quality
- Open [**Review every generated task for complexity, vagueness, and triviality**](practice-review-every-generated-task-for-complexity-vagueness-and-triviality.md) — After task generation, split tasks spanning 3+ technologies/skills, sharpen vague acceptance criteria, and merge trivial tasks.
### #scripts
- Open [**extract-task-skills.cjs**](map-extract-task-skills-cjs.md) — Helper script that extracts the \`skills\` array from a task file's frontmatter.
### #task-status
- Open [**Follow the allowed task status transitions**](practice-follow-the-allowed-task-status-transitions.md) — Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress.
### #tests
- Open [**Review plans against PRD and test/features updates**](practice-review-plans-against-prd-and-test-features-updates.md) — After producing a plan, confirm whether PRD.md and test/features need updates, keeping additions succinct and skipping them for minimal changes.