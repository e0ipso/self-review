# kenkeep Index: planning / authoring

↑ Parent: [planning](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Check plans for architecture and code reuse improvements**](practice-check-plans-for-architecture-and-code-reuse-improvements.md) to learn about: Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing. #planning #architecture #code-reuse
- Open [**Review plans against PRD and test/features updates**](practice-review-plans-against-prd-and-test-features-updates.md) to learn about: After producing a plan, confirm whether PRD.md and test/features need updates, keeping additions succinct and skipping them for minimal changes. #planning #prd #tests
- Open [**Write PRDs without tasks or phases during plan creation**](practice-write-prds-without-tasks-or-phases-during-plan-creation.md) to learn about: Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step. #planning #prd #workflow

## Components (what exists)
- Open [**POST_PLAN hook**](map-post-plan-hook.md) to learn about: Task-manager hook at .ai/task-manager/config/hooks/POST_PLAN.md that gates plans on PRD/test updates and architecture review. #hooks #task-manager #planning
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) to learn about: Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation. #task-manager #hook #workflow

## By topic

### #planning
- Open [**Review plans against PRD and test/features updates**](practice-review-plans-against-prd-and-test-features-updates.md) — After producing a plan, confirm whether PRD.md and test/features need updates, keeping additions succinct and skipping them for minimal changes.
- Open [**Write PRDs without tasks or phases during plan creation**](practice-write-prds-without-tasks-or-phases-during-plan-creation.md) — Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step.
- Open [**Check plans for architecture and code reuse improvements**](practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing.
### #prd
- Open [**Review plans against PRD and test/features updates**](practice-review-plans-against-prd-and-test-features-updates.md) — After producing a plan, confirm whether PRD.md and test/features need updates, keeping additions succinct and skipping them for minimal changes.
- Open [**Write PRDs without tasks or phases during plan creation**](practice-write-prds-without-tasks-or-phases-during-plan-creation.md) — Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step.
### #task-manager
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #workflow
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Follow the allowed task status transitions**](../execution/practice-follow-the-allowed-task-status-transitions.md) — Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress.
### #architecture
- Open [**Check plans for architecture and code reuse improvements**](practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing.
- Open [**Do not import sibling packages from @self-review/types**](../../packages/types/practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
- Open [**Two-process Electron architecture**](../../app/architecture/map-two-process-electron-architecture.md) — Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge.
### #code-reuse
- Open [**Check plans for architecture and code reuse improvements**](practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Each plan must identify how architecture and code reuse can be improved in its areas of influence; update the plan if missing.
- Open [**Extract shared logic before duplicating across call sites**](../../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #hook
- Open [**POST_PHASE hook**](../execution/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
### #hooks
- Open [**PRE_TASK_ASSIGNMENT hook**](../assignment/map-pre-task-assignment-hook.md) — Hook that runs before task assignment to select an appropriate agent for each task based on required skills.
- Open [**POST_PLAN hook**](map-post-plan-hook.md) — Task-manager hook at .ai/task-manager/config/hooks/POST_PLAN.md that gates plans on PRD/test updates and architecture review.
- Open [**Do not hand-edit INDEX.md or GRAPH.md**](../../knowledge-base/structure/practice-do-not-hand-edit-index-md-or-graph-md.md) — Both files are regenerated automatically by the lint-staged pre-commit hook and staged into the commit.
### #tests
- Open [**Review plans against PRD and test/features updates**](practice-review-plans-against-prd-and-test-features-updates.md) — After producing a plan, confirm whether PRD.md and test/features need updates, keeping additions succinct and skipping them for minimal changes.