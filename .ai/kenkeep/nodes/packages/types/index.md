# kenkeep Index: packages / types

↑ Parent: [packages](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Define shared data structures only in @self-review/types**](practice-define-shared-data-structures-only-in-self-review-types.md) to learn about: Use @self-review/types as the single source of truth for data structures shared across packages and the Electron app. #types #single-source #shared
- Open [**Do not import sibling packages from @self-review/types**](practice-do-not-import-sibling-packages-from-self-review-types.md) to learn about: The types package is a leaf dependency and must never import from @self-review/core or @self-review/react. #types #imports #architecture
- Open [**Keep @self-review/types free of runtime dependencies**](practice-keep-self-review-types-free-of-runtime-dependencies.md) to learn about: The types package must never add runtime dependencies in package.json; it exists solely for type exports. #types #dependencies #packages
- Open [**Keep all @self-review/types definitions in src/index.ts**](practice-keep-all-self-review-types-definitions-in-src-index-ts.md) to learn about: At current scale, all types live in src/index.ts with no subdirectories. #types #structure #layout

## Components (what exists)
- Open [**@self-review/types package**](map-self-review-types-package.md) to learn about: Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies. #packages #types #workspace

## By topic

### #types
- Open [**@self-review/types package**](map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**Keep @self-review/types free of runtime dependencies**](practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
- Open [**Define shared data structures only in @self-review/types**](practice-define-shared-data-structures-only-in-self-review-types.md) — Use @self-review/types as the single source of truth for data structures shared across packages and the Electron app.
### #packages
- Open [**@self-review/types package**](map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**Keep @self-review/types free of runtime dependencies**](practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
- Open [**npm workspaces packages**](../architecture/map-npm-workspaces-packages.md) — Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types).
### #architecture
- Open [**Two-process Electron architecture**](../../app/architecture/map-two-process-electron-architecture.md) — Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge.
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](../architecture/practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) — Abstract expand-context, image loading, and output-path changes via ReviewAdapter.
- Open [**Do not import sibling packages from @self-review/types**](practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
### #dependencies
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](../../planning/task-generation/practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**Do not add Tailwind as a peer dependency for host apps**](../styling/practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) — tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind.
- Open [**Keep @self-review/types free of runtime dependencies**](practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
### #imports
- Open [**Do not import from @self-review/core in the react package**](../architecture/practice-do-not-import-from-self-review-core-in-the-react-package.md) — Importing core risks pulling Node-only code into the browser bundle.
- Open [**Import only the compiled dist/styles.css from host apps**](../styling/practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
- Open [**Do not import sibling packages from @self-review/types**](practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
### #layout
- Open [**Keep all @self-review/types definitions in src/index.ts**](practice-keep-all-self-review-types-definitions-in-src-index-ts.md) — At current scale, all types live in src/index.ts with no subdirectories.
- Open [**Kenkeep directory layout**](../../knowledge-base/structure/map-knowledge-base-directory-layout-under-ai-knowledge-base.md) — Nodes use topical folders; sessions, conflicts and logs have separate directories.
- Open [**Knowledge node placement**](../../knowledge-base/structure/map-knowledge-base-node-layout.md) — Stable node IDs live in topical folders, independent of practice/map kind.
### #shared
- Open [**Define shared data structures only in @self-review/types**](practice-define-shared-data-structures-only-in-self-review-types.md) — Use @self-review/types as the single source of truth for data structures shared across packages and the Electron app.
### #single-source
- Open [**Define shared data structures only in @self-review/types**](practice-define-shared-data-structures-only-in-self-review-types.md) — Use @self-review/types as the single source of truth for data structures shared across packages and the Electron app.
### #structure
- Open [**.ai/kenkeep directory**](../../knowledge-base/structure/map-ai-knowledge-base-directory.md) — Topical knowledge nodes, captured sessions, conflicts and generated navigation.
- Open [**Keep all @self-review/types definitions in src/index.ts**](practice-keep-all-self-review-types-definitions-in-src-index-ts.md) — At current scale, all types live in src/index.ts with no subdirectories.
### #workspace
- Open [**@self-review/types package**](map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**npm workspaces packages**](../architecture/map-npm-workspaces-packages.md) — Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types).