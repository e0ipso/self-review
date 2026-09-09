# kenkeep Index: planning / authoring

↑ Parent: [planning](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Keep architecture decisions within the requested plan scope**](practice-check-plans-for-architecture-and-code-reuse-improvements.md) to learn about: Use PRE_PLAN simplicity and scope rules when evaluating abstractions. #planning #architecture #code-reuse
- Open [**Specify plan validation and documentation needs**](practice-review-plans-against-prd-and-test-features-updates.md) to learn about: Include Self Validation and decide whether documentation or AGENTS.md needs updates. #planning #prd #tests
- Open [**Write PRDs without tasks or phases during plan creation**](practice-write-prds-without-tasks-or-phases-during-plan-creation.md) to learn about: Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step. #planning #prd #workflow

## Components (what exists)
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) to learn about: Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation. #strikethroo #hooks #workflow
- Open [**POST_PLAN hook**](map-post-plan-hook.md) to learn about: Require self-validation steps and decide whether docs or AGENTS.md need updates. #hooks #strikethroo #planning

## By topic

### #planning
- Open [**POST_PLAN hook**](map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
- Open [**Specify plan validation and documentation needs**](practice-review-plans-against-prd-and-test-features-updates.md) — Include Self Validation and decide whether documentation or AGENTS.md needs updates.
- Open [**Write PRDs without tasks or phases during plan creation**](practice-write-prds-without-tasks-or-phases-during-plan-creation.md) — Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step.
### #hooks
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**PRE_TASK_ASSIGNMENT hook**](../assignment/map-pre-task-assignment-hook.md) — Match task skills and domain to available agents in the active harness.
### #prd
- Open [**Specify plan validation and documentation needs**](practice-review-plans-against-prd-and-test-features-updates.md) — Include Self Validation and decide whether documentation or AGENTS.md needs updates.
- Open [**Write PRDs without tasks or phases during plan creation**](practice-write-prds-without-tasks-or-phases-during-plan-creation.md) — Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step.
### #strikethroo
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**POST_PLAN hook**](map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
### #workflow
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**Knowledge-base capture and curation workflow**](../../knowledge-base/curate/map-knowledge-base-capture-curate-review-workflow.md) — Capture sessions, extract proposals, curate nodes and consume topical navigation.
### #architecture
- Open [**Two-process Electron architecture**](../../app/architecture/map-two-process-electron-architecture.md) — Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge.
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](../../packages/architecture/practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) — Abstract expand-context, image loading, and output-path changes via ReviewAdapter.
- Open [**Do not import sibling packages from @self-review/types**](../../packages/types/practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
### #code-reuse
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
- Open [**Keep architecture decisions within the requested plan scope**](practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Use PRE_PLAN simplicity and scope rules when evaluating abstractions.
### #tests
- Open [**Specify plan validation and documentation needs**](practice-review-plans-against-prd-and-test-features-updates.md) — Include Self Validation and decide whether documentation or AGENTS.md needs updates.