# kenkeep Index: planning / execution

↑ Parent: [planning](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Complete configured checks and commit each phase**](practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase.md) to learn about: Run checks defined by the phase hook and create a descriptive conventional commit. #workflow #linting #commits
- Open [**Follow the allowed task status transitions**](practice-follow-the-allowed-task-status-transitions.md) to learn about: Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress. #workflow #task-status
- Open [**Mark completed phases and tasks in the blueprint before advancing**](practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing.md) to learn about: After validating a phase, update the blueprint: ✅ in front of the phase title, ✔️ in front of each task, and set task status to completed. #workflow #progress-tracking #blueprint

## Components (what exists)
- Open [**POST_PHASE hook**](map-post-phase-hook.md) to learn about: Create a phase commit and update blueprint progress before advancing. #hooks #workflow #strikethroo

## By topic

### #workflow
- Open [**PRE_PLAN hook**](../authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**Knowledge-base capture and curation workflow**](../../knowledge-base/curate/map-knowledge-base-capture-curate-review-workflow.md) — Capture sessions, extract proposals, curate nodes and consume topical navigation.
### #blueprint
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](../task-generation/practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**Mark completed phases and tasks in the blueprint before advancing**](practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing.md) — After validating a phase, update the blueprint: ✅ in front of the phase title, ✔️ in front of each task, and set task status to completed.
### #commits
- Open [**Complete configured checks and commit each phase**](practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase.md) — Run checks defined by the phase hook and create a descriptive conventional commit.
### #hooks
- Open [**PRE_PLAN hook**](../authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**PRE_TASK_ASSIGNMENT hook**](../assignment/map-pre-task-assignment-hook.md) — Match task skills and domain to available agents in the active harness.
### #linting
- Open [**Complete configured checks and commit each phase**](practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase.md) — Run checks defined by the phase hook and create a descriptive conventional commit.
### #progress-tracking
- Open [**Mark completed phases and tasks in the blueprint before advancing**](practice-mark-completed-phases-and-tasks-in-the-blueprint-before-advancing.md) — After validating a phase, update the blueprint: ✅ in front of the phase title, ✔️ in front of each task, and set task status to completed.
### #strikethroo
- Open [**PRE_PLAN hook**](../authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**POST_PLAN hook**](../authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
### #task-status
- Open [**Follow the allowed task status transitions**](practice-follow-the-allowed-task-status-transitions.md) — Use only the defined transitions: pending→in-progress, in-progress→completed, in-progress→failed, failed→in-progress.