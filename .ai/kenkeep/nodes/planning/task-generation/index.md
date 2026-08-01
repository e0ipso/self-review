# kenkeep Index: planning / task-generation

↑ Parent: [planning](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) to learn about: After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document. #task-management #blueprint #dependencies
- Open [**Review every generated task for complexity, vagueness, and triviality**](practice-review-every-generated-task-for-complexity-vagueness-and-triviality.md) to learn about: After task generation, split tasks spanning 3+ technologies/skills, sharpen vague acceptance criteria, and merge trivial tasks. #task-management #planning #quality

## Components (what exists)
- Open [**POST_TASK_GENERATION_ALL hook**](map-post-task-generation-all-hook.md) to learn about: Lifecycle hook that runs after all tasks are generated to review complexity and append a blueprint to the plan. #task-management #hooks #lifecycle

## By topic

### #task-management
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**POST_TASK_GENERATION_ALL hook**](map-post-task-generation-all-hook.md) — Lifecycle hook that runs after all tasks are generated to review complexity and append a blueprint to the plan.
- Open [**Review every generated task for complexity, vagueness, and triviality**](practice-review-every-generated-task-for-complexity-vagueness-and-triviality.md) — After task generation, split tasks spanning 3+ technologies/skills, sharpen vague acceptance criteria, and merge trivial tasks.
### #blueprint
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**Mark completed phases and tasks in the blueprint before advancing**](../execution/practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing.md) — After validating a phase, update the blueprint: ✅ in front of the phase title, ✔️ in front of each task, and set task status to completed.
### #dependencies
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**Do not add Tailwind as a peer dependency for host apps**](../../packages/styling/practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) — tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind.
- Open [**Keep @self-review/types free of runtime dependencies**](../../packages/types/practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
### #hooks
- Open [**PRE_TASK_ASSIGNMENT hook**](../assignment/map-pre-task-assignment-hook.md) — Hook that runs before task assignment to select an appropriate agent for each task based on required skills.
- Open [**POST_PLAN hook**](../authoring/map-post-plan-hook.md) — Task-manager hook at .ai/task-manager/config/hooks/POST_PLAN.md that gates plans on PRD/test updates and architecture review.
- Open [**Do not hand-edit INDEX.md or GRAPH.md**](../../knowledge-base/structure/practice-do-not-hand-edit-index-md-or-graph-md.md) — Both files are regenerated automatically by the lint-staged pre-commit hook and staged into the commit.
### #lifecycle
- Open [**POST_TASK_GENERATION_ALL hook**](map-post-task-generation-all-hook.md) — Lifecycle hook that runs after all tasks are generated to review complexity and append a blueprint to the plan.
### #planning
- Open [**Review plans against PRD and test/features updates**](../authoring/practice-review-plans-against-prd-and-test-features-updates.md) — After producing a plan, confirm whether PRD.md and test/features need updates, keeping additions succinct and skipping them for minimal changes.
- Open [**Write PRDs without tasks or phases during plan creation**](../authoring/practice-write-prds-without-tasks-or-phases-during-plan-creation.md) — Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step.
- Open [**Check plans for architecture and code reuse improvements**](../authoring/practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing.
### #quality
- Open [**Review every generated task for complexity, vagueness, and triviality**](practice-review-every-generated-task-for-complexity-vagueness-and-triviality.md) — After task generation, split tasks spanning 3+ technologies/skills, sharpen vague acceptance criteria, and merge trivial tasks.