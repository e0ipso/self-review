# kenkeep Index: planning / task-generation

↑ Parent: [planning](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) to learn about: After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document. #strikethroo #blueprint #dependencies
- Open [**Score and refine generated task complexity**](practice-review-every-generated-task-for-complexity-vagueness-and-triviality.md) to learn about: Keep tasks single-purpose with runnable acceptance checks and one or two skills. #strikethroo #planning #quality

## Components (what exists)
- Open [**POST_TASK_GENERATION_ALL hook**](map-post-task-generation-all-hook.md) to learn about: Append an acyclic dependency diagram and ordered execution phases. #strikethroo #hooks #lifecycle

## By topic

### #strikethroo
- Open [**PRE_PLAN hook**](../authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**POST_PLAN hook**](../authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
### #blueprint
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**Mark completed phases and tasks in the blueprint before advancing**](../execution/practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing.md) — After validating a phase, update the blueprint: ✅ in front of the phase title, ✔️ in front of each task, and set task status to completed.
### #dependencies
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**Do not add Tailwind as a peer dependency for host apps**](../../packages/styling/practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) — tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind.
- Open [**Keep @self-review/types free of runtime dependencies**](../../packages/types/practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
### #hooks
- Open [**PRE_PLAN hook**](../authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**PRE_TASK_ASSIGNMENT hook**](../assignment/map-pre-task-assignment-hook.md) — Match task skills and domain to available agents in the active harness.
### #lifecycle
- Open [**POST_TASK_GENERATION_ALL hook**](map-post-task-generation-all-hook.md) — Append an acyclic dependency diagram and ordered execution phases.
### #planning
- Open [**POST_PLAN hook**](../authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
- Open [**Specify plan validation and documentation needs**](../authoring/practice-review-plans-against-prd-and-test-features-updates.md) — Include Self Validation and decide whether documentation or AGENTS.md needs updates.
- Open [**Write PRDs without tasks or phases during plan creation**](../authoring/practice-write-prds-without-tasks-or-phases-during-plan-creation.md) — Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step.
### #quality
- Open [**Score and refine generated task complexity**](practice-review-every-generated-task-for-complexity-vagueness-and-triviality.md) — Keep tasks single-purpose with runnable acceptance checks and one or two skills.