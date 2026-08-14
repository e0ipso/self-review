# kenkeep Index: packages / styling

↑ Parent: [packages](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Do not add Tailwind as a peer dependency for host apps**](practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) to learn about: tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind. #css #tailwind #dependencies
- Open [**Import only the compiled dist/styles.css from host apps**](practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) to learn about: src/styles.css and src/build-styles.css are build inputs only; never import them. #css #build #imports
- Open [**Pass portalContainer to all Radix/shadcn portal components**](practice-pass-portalcontainer-to-all-radix-shadcn-portal-components.md) to learn about: Portals must render inside the .self-review subtree to inherit dark-mode variables. #radix #portals #theming
- Open [**Scope styles and dark mode via the .self-review wrapper div**](practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div.md) to learn about: All overrides are prefixed .self-review; dark class toggles on the wrapper, not html. #css #scoping #theming

## Components (what exists)
- Open [**.self-review wrapper div**](map-self-review-wrapper-div.md) to learn about: Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode toggling. #dom #scoping #theming
- Open [**CSS build pipeline for @self-review/react**](map-css-build-pipeline-for-self-review-react.md) to learn about: tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css. #css #build #tailwind

## By topic

### #css
- Open [**CSS build pipeline for @self-review/react**](map-css-build-pipeline-for-self-review-react.md) — tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css.
- Open [**Do not add Tailwind as a peer dependency for host apps**](practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) — tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind.
- Open [**Import only the compiled dist/styles.css from host apps**](practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
### #theming
- Open [**.self-review wrapper div**](map-self-review-wrapper-div.md) — Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode toggling.
- Open [**Scope styles and dark mode via the .self-review wrapper div**](practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div.md) — All overrides are prefixed .self-review; dark class toggles on the wrapper, not html.
- Open [**Pass portalContainer to all Radix/shadcn portal components**](practice-pass-portalcontainer-to-all-radix-shadcn-portal-components.md) — Portals must render inside the .self-review subtree to inherit dark-mode variables.
### #build
- Open [**CSS build pipeline for @self-review/react**](map-css-build-pipeline-for-self-review-react.md) — tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css.
- Open [**Import only the compiled dist/styles.css from host apps**](practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
- Open [**Do not install or use webpack**](../../engineering/practice-do-not-install-or-use-webpack.md) — Electron Forge handles bundling; do not add a separate webpack configuration.
### #scoping
- Open [**.self-review wrapper div**](map-self-review-wrapper-div.md) — Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode toggling.
- Open [**Scope styles and dark mode via the .self-review wrapper div**](practice-scope-styles-and-dark-mode-via-the-self-review-wrapper-div.md) — All overrides are prefixed .self-review; dark class toggles on the wrapper, not html.
### #tailwind
- Open [**CSS build pipeline for @self-review/react**](map-css-build-pipeline-for-self-review-react.md) — tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css.
- Open [**Do not add Tailwind as a peer dependency for host apps**](practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) — tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind.
### #dependencies
- Open [**Append a blueprint with dependency diagram and execution phases to the plan**](../../planning/task-generation/practice-append-a-blueprint-with-dependency-diagram-and-execution-phases-to-the-plan.md) — After finalizing tasks, add a Mermaid dependency graph and group tasks into execution phases on the plan document.
- Open [**Do not add Tailwind as a peer dependency for host apps**](practice-do-not-add-tailwind-as-a-peer-dependency-for-host-apps.md) — tailwindcss and @tailwindcss/typography are devDependencies; consumers ship no Tailwind.
- Open [**Keep @self-review/types free of runtime dependencies**](../types/practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
### #dom
- Open [**.self-review wrapper div**](map-self-review-wrapper-div.md) — Scoping wrapper rendered by ConfigProvider for CSS containment and dark-mode toggling.
### #imports
- Open [**Do not import from @self-review/core in the react package**](../architecture/practice-do-not-import-from-self-review-core-in-the-react-package.md) — Importing core risks pulling Node-only code into the browser bundle.
- Open [**Do not import sibling packages from @self-review/types**](../types/practice-do-not-import-sibling-packages-from-self-review-types.md) — The types package is a leaf dependency and must never import from @self-review/core or @self-review/react.
- Open [**Import only the compiled dist/styles.css from host apps**](practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
### #portals
- Open [**Pass portalContainer to all Radix/shadcn portal components**](practice-pass-portalcontainer-to-all-radix-shadcn-portal-components.md) — Portals must render inside the .self-review subtree to inherit dark-mode variables.
### #radix
- Open [**Pass portalContainer to all Radix/shadcn portal components**](practice-pass-portalcontainer-to-all-radix-shadcn-portal-components.md) — Portals must render inside the .self-review subtree to inherit dark-mode variables.