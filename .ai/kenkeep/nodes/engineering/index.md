# kenkeep Index: engineering

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Check the existing Forge bundler before changing build tooling**](practice-do-not-install-or-use-webpack.md) to learn about: The blanket webpack prohibition conflicts with the configured Forge webpack integration. #strikethroo #build #webpack
- Open [**Do not run e2e tests inside the dev container**](practice-do-not-run-e2e-tests-inside-the-dev-container.md) to learn about: E2E tests require a host machine with display; check for dev container before running them. #strikethroo #testing #devcontainer
- Open [**Don't support Windows**](practice-don-t-support-windows.md) to learn about: Windows is explicitly out of scope. Supported platforms are macOS and Linux (x64 and arm64). #platform #scope
- Open [**Exclude generated assistant tooling from ESLint**](practice-exclude-generated-assistant-tooling-from-eslint.md) to learn about: Ignore bundled assistant tooling directories in ESLint. #lint #tooling
- Open [**Extract shared logic before duplicating across call sites**](practice-extract-shared-logic-before-duplicating-across-call-sites.md) to learn about: Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify. #strikethroo #code-reuse #duplication
- Open [**Favor simple, maintainable solutions over clever ones**](practice-favor-simple-maintainable-solutions-over-clever-ones.md) to learn about: Choose the most straightforward approach. Use standard patterns, minimal dependencies, and readable code over complex abstractions. #simplicity #code-quality #maintainability
- Open [**Fix the root cause in tests, never write test-specific code in production**](practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production.md) to learn about: No environment detection, no conditional test bypasses; green tests must mean the code actually works. #strikethroo #testing #root-cause
- Open [**Implement only what the user explicitly requests**](practice-implement-only-what-the-user-explicitly-requests.md) to learn about: Build the minimal viable solution. Don't add features, abstractions, or backwards compatibility unless asked. #scope #planning #yagni
- Open [**Lead each platform installation section with Homebrew**](practice-lead-each-platform-installation-section-with-homebrew.md) to learn about: Document Homebrew first within each platform section; collapse manual instructions. #installation #docs
- Open [**Upload release ZIPs using the MakerZIP filenames**](practice-upload-release-zips-using-the-makerzip-filenames.md) to learn about: Upload MakerZIP archives directly by glob without renaming them. #release #packaging
- Open [**Use conventional commit naming for PR titles**](practice-use-conventional-commit-naming-for-pr-titles.md) to learn about: PR titles must follow the conventional commit convention. #strikethroo #pr #conventional-commits

## Components (what exists)
- Open [**Testing layers (unit + e2e)**](map-testing-layers-unit-e2e.md) to learn about: Vitest for fast unit tests; Playwright + Cucumber for webapp e2e (CI) and Electron e2e (local only). #strikethroo #testing #layers

## By topic

### #strikethroo
- Open [**PRE_PLAN hook**](../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**POST_PLAN hook**](../planning/authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
### #testing
- Open [**Do not run e2e tests inside the dev container**](practice-do-not-run-e2e-tests-inside-the-dev-container.md) — E2E tests require a host machine with display; check for dev container before running them.
- Open [**Fix the root cause in tests, never write test-specific code in production**](practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production.md) — No environment detection, no conditional test bypasses; green tests must mean the code actually works.
- Open [**Testing layers (unit + e2e)**](map-testing-layers-unit-e2e.md) — Vitest for fast unit tests; Playwright + Cucumber for webapp e2e (CI) and Electron e2e (local only).
### #scope
- Open [**Default bootstrap scope**](../knowledge-base/bootstrap/discovery/map-default-bootstrap-scope.md) — Without a scope argument, finddocs scans from the repository root.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../knowledge-base/bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Skip files that look correct rather than forcing comments**](../skills/critique/review-strategy/practice-skip-files-that-look-correct-rather-than-forcing-comments.md) — Critique should leave a file un-commented when nothing substantive is wrong; do not manufacture review comments on every file.
### #build
- Open [**CSS build pipeline for @self-review/react**](../packages/styling/map-css-build-pipeline-for-self-review-react.md) — tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css.
- Open [**Import only the compiled dist/styles.css from host apps**](../packages/styling/practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
- Open [**Check the existing Forge bundler before changing build tooling**](practice-do-not-install-or-use-webpack.md) — The blanket webpack prohibition conflicts with the configured Forge webpack integration.
### #code-quality
- Open [**Favor simple, maintainable solutions over clever ones**](practice-favor-simple-maintainable-solutions-over-clever-ones.md) — Choose the most straightforward approach. Use standard patterns, minimal dependencies, and readable code over complex abstractions.
### #code-reuse
- Open [**Extract shared logic before duplicating across call sites**](practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
- Open [**Keep architecture decisions within the requested plan scope**](../planning/authoring/practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Use PRE_PLAN simplicity and scope rules when evaluating abstractions.
### #conventional-commits
- Open [**Use conventional commit naming for PR titles**](practice-use-conventional-commit-naming-for-pr-titles.md) — PR titles must follow the conventional commit convention.
### #devcontainer
- Open [**Do not run e2e tests inside the dev container**](practice-do-not-run-e2e-tests-inside-the-dev-container.md) — E2E tests require a host machine with display; check for dev container before running them.
### #docs
- Open [**Lead each platform installation section with Homebrew**](practice-lead-each-platform-installation-section-with-homebrew.md) — Document Homebrew first within each platform section; collapse manual instructions.
### #duplication
- Open [**Extract shared logic before duplicating across call sites**](practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
- Open [**Keep file-type detection utilities duplicated across core and react packages**](../packages/architecture/practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) — getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated.
- Open [**Use src/shared/types.ts as the single source of truth for shared types**](../app/architecture/practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types.md) — All main and renderer code imports shared types from src/shared/types.ts; never duplicate definitions.
### #installation
- Open [**Lead each platform installation section with Homebrew**](practice-lead-each-platform-installation-section-with-homebrew.md) — Document Homebrew first within each platform section; collapse manual instructions.
### #layers
- Open [**Testing layers (unit + e2e)**](map-testing-layers-unit-e2e.md) — Vitest for fast unit tests; Playwright + Cucumber for webapp e2e (CI) and Electron e2e (local only).
### #lint
- Open [**Exclude generated assistant tooling from ESLint**](practice-exclude-generated-assistant-tooling-from-eslint.md) — Ignore bundled assistant tooling directories in ESLint.
### #maintainability
- Open [**Favor simple, maintainable solutions over clever ones**](practice-favor-simple-maintainable-solutions-over-clever-ones.md) — Choose the most straightforward approach. Use standard patterns, minimal dependencies, and readable code over complex abstractions.
### #packaging
- Open [**Upload release ZIPs using the MakerZIP filenames**](practice-upload-release-zips-using-the-makerzip-filenames.md) — Upload MakerZIP archives directly by glob without renaming them.
### #planning
- Open [**POST_PLAN hook**](../planning/authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
- Open [**Specify plan validation and documentation needs**](../planning/authoring/practice-review-plans-against-prd-and-test-features-updates.md) — Include Self Validation and decide whether documentation or AGENTS.md needs updates.
- Open [**Write PRDs without tasks or phases during plan creation**](../planning/authoring/practice-write-prds-without-tasks-or-phases-during-plan-creation.md) — Plan creation produces the PRD only. Tasks and phases are generated in a later workflow step.
### #platform
- Open [**ReviewAdapter interface**](../packages/architecture/map-reviewadapter-interface.md) — Abstraction for platform-specific operations defined in src/adapter.ts.
- Open [**Use the ReviewAdapter pattern for platform-specific operations**](../packages/architecture/practice-use-the-reviewadapter-pattern-for-platform-specific-operations.md) — Abstract expand-context, image loading, and output-path changes via ReviewAdapter.
- Open [**Don't support Windows**](practice-don-t-support-windows.md) — Windows is explicitly out of scope. Supported platforms are macOS and Linux (x64 and arm64).
### #pr
- Open [**Use conventional commit naming for PR titles**](practice-use-conventional-commit-naming-for-pr-titles.md) — PR titles must follow the conventional commit convention.
### #release
- Open [**Upload release ZIPs using the MakerZIP filenames**](practice-upload-release-zips-using-the-makerzip-filenames.md) — Upload MakerZIP archives directly by glob without renaming them.
### #root-cause
- Open [**Fix the root cause in tests, never write test-specific code in production**](practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production.md) — No environment detection, no conditional test bypasses; green tests must mean the code actually works.
### #simplicity
- Open [**Favor simple, maintainable solutions over clever ones**](practice-favor-simple-maintainable-solutions-over-clever-ones.md) — Choose the most straightforward approach. Use standard patterns, minimal dependencies, and readable code over complex abstractions.
### #tooling
- Open [**Exclude generated assistant tooling from ESLint**](practice-exclude-generated-assistant-tooling-from-eslint.md) — Ignore bundled assistant tooling directories in ESLint.
### #webpack
- Open [**Check the existing Forge bundler before changing build tooling**](practice-do-not-install-or-use-webpack.md) — The blanket webpack prohibition conflicts with the configured Forge webpack integration.
### #yagni
- Open [**Implement only what the user explicitly requests**](practice-implement-only-what-the-user-explicitly-requests.md) — Build the minimal viable solution. Don't add features, abstractions, or backwards compatibility unless asked.