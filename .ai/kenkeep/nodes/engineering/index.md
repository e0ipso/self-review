# kenkeep Index: engineering

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Both e2e projects run in the dev container; the Electron tier needs two apt packages**](practice-run-the-webapp-e2e-project-in-the-dev-container.md) to learn about: npm run test:e2e and npm run test:e2e:electron both pass in the container once xauth and libgtk-3-0 are installed. #testing #e2e #playwright #devcontainer
- Open [**Use conventional commit naming for PR titles**](practice-use-conventional-commit-naming-for-pr-titles.md) to learn about: PR titles must follow the conventional commit convention. #strikethroo #pr #conventional-commits
- Open [**Check the existing Forge bundler before changing build tooling**](practice-do-not-install-or-use-webpack.md) to learn about: Forge is the build entry point; bundling changes belong in the three webpack configs its plugin points at. #strikethroo #build #webpack
- Open [**Formatting is enforced by lint-staged and CI**](practice-formatting-is-enforced-by-lint-staged-and-ci.md) to learn about: Prettier runs on staged files via .husky/pre-commit and CI runs npm run format:check; printWidth is 100. #formatting #prettier #husky #ci
- Open [**Keep extra worktrees out of the repo root**](practice-keep-extra-worktrees-out-of-the-repo-root.md) to learn about: ESLint and Prettier walk a nested worktree even when git excludes it, and a hardlinked node_modules is shared. #worktree #tooling #lint #node-modules
- Open [**Run npm run prepare in a fresh worktree or the pre-commit hook silently skips**](practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md) to learn about: core.hooksPath points at .husky/_, which husky generates and git never tracks, so a new worktree commits with no hook and no warning. #git #worktree #husky #hooks #gotcha
- Open [**Upload release ZIPs using the MakerZIP filenames**](practice-upload-release-zips-using-the-makerzip-filenames.md) to learn about: Upload MakerZIP archives directly by glob without renaming them. #release #packaging
- Open [**Don't support Windows**](practice-don-t-support-windows.md) to learn about: Windows is explicitly out of scope. Supported platforms are macOS and Linux (x64 and arm64). #platform #scope
- Open [**Exclude generated assistant tooling from ESLint**](practice-exclude-generated-assistant-tooling-from-eslint.md) to learn about: Ignore bundled assistant tooling directories in ESLint. #lint #tooling
- Open [**Extract shared logic before duplicating across call sites**](practice-extract-shared-logic-before-duplicating-across-call-sites.md) to learn about: Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify. #strikethroo #code-reuse #duplication
- Open [**Favor simple, maintainable solutions over clever ones**](practice-favor-simple-maintainable-solutions-over-clever-ones.md) to learn about: Choose the most straightforward approach. Use standard patterns, minimal dependencies, and readable code over complex abstractions. #simplicity #code-quality #maintainability
- Open [**Fix the root cause in tests, never write test-specific code in production**](practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production.md) to learn about: No environment detection, no conditional test bypasses; green tests must mean the code actually works. #strikethroo #testing #root-cause
- Open [**Fix webpack type-checking in the root tsconfig.json, not in a webpack config**](practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config.md) to learn about: fork-ts-checker defaults configFile to <context>/tsconfig.json and all three webpack configs set context to the project root. #build #webpack #typescript #tsconfig
- Open [**Implement only what the user explicitly requests**](practice-implement-only-what-the-user-explicitly-requests.md) to learn about: Build the minimal viable solution. Don't add features, abstractions, or backwards compatibility unless asked. #scope #planning #yagni
- Open [**Install libgtk-3-0, never libgtk-3-0t64**](practice-install-libgtk-3-0-never-libgtk-3-0t64.md) to learn about: libgtk-3-0 is virtual on Ubuntu noble but installs through Provides; the t64 spelling breaks the Debian 12 dev container. #apt #ubuntu #debian #devcontainer #ci #electron
- Open [**Lead each platform installation section with Homebrew**](practice-lead-each-platform-installation-section-with-homebrew.md) to learn about: Document Homebrew first within each platform section; collapse manual instructions. #installation #docs
- Open [**asarUnpack is electron-builder's key; @electron/packager spells it asar.unpack**](practice-use-asar-unpack-not-asarunpack-in-forge-config.md) to learn about: Forge drops an asarUnpack key on the floor. The packager option is asar: { unpack }, and this repo needs neither. #electron #forge #packaging #asar #xmllint
- Open [**Check each package with its own tsconfig; the root program only follows imports**](practice-check-each-package-with-its-own-tsconfig.md) to learn about: The root program includes only src/**/*, so package files the app never imports are covered by typecheck:packages alone. #typescript #tsconfig #typecheck #packages #ci
- Open [**Commitlint rejects agent attribution in the message and the author email**](practice-strip-agent-attribution-from-commit-messages.md) to learn about: A Co-Authored-By trailer naming an assistant fails commit-msg; so does an author email carrying an assistant keyword. #git #commitlint #husky #commits
- Open [**Drive resizable panels through the imperative handle in jsdom**](practice-drive-resizable-panels-through-the-imperative-handle-in-jsdom.md) to learn about: react-resizable-panels needs a ResizeObserver stub under jsdom and never fires onResize there. #testing #jsdom #react #panels
- Open [**Install Playwright's Chromium and its system libraries before the first e2e run**](practice-install-playwright-chromium-and-its-system-libraries-before-the-first-e2e-run.md) to learn about: A fresh container needs npx playwright install chromium plus sudo npx playwright install-deps chromium, or Chromium fails on libnspr4.so. #testing #e2e #playwright #devcontainer #setup
- Open [**Pin Nix fetchzip hashes to the unpacked directory**](practice-pin-nix-fetchzip-hashes-to-the-unpacked-directory.md) to learn about: A fetchzip hash covers the unpacked tree, never the archive bytes; update-flake-hash.sh prefetches with --unpack. #nix #packaging #flake #build
- Open [**Scrub git's repository env vars before spawning git in tests**](practice-scrub-git-repository-env-vars-before-spawning-git-in-tests.md) to learn about: Git's hook environment outranks cwd and git -C; packages/core/vitest.setup.ts strips it so suites stay hermetic. #testing #git #hooks #hermetic-tests
- Open [**Spawn git with an argv array, never a shell string**](practice-spawn-git-with-an-argv-array-never-a-shell-string.md) to learn about: Diff arguments reach git through execFile; joining argv into a command line let a command substitution run. #security #git #subprocess #shell-injection
- Open [**Write node_modules without a trailing slash in .gitignore**](practice-write-node-modules-without-a-trailing-slash-in-gitignore.md) to learn about: A trailing slash matches directories only, so the symlinked node_modules a prepared worktree gets shows up as untracked. #git #gitignore #worktree #tooling

## Components (what exists)
- Open [**Testing layers (unit + e2e)**](map-testing-layers-unit-e2e.md) to learn about: Vitest for fast unit tests; Playwright + Cucumber for webapp e2e (CI) and Electron e2e (not run in CI). #strikethroo #testing #layers
- Open [**Seven tsc programs behind five typecheck npm scripts**](map-type-check-programs-and-scripts.md) to learn about: typecheck, typecheck:tests, typecheck:unit, typecheck:packages and typecheck:configs cover seven tsconfig programs; the CI lint job gates on all five. #typescript #tsconfig #typecheck #ci #build

## By topic

### #testing
- Open [**Both e2e projects run in the dev container; the Electron tier needs two apt packages**](practice-run-the-webapp-e2e-project-in-the-dev-container.md) — npm run test:e2e and npm run test:e2e:electron both pass in the container once xauth and libgtk-3-0 are installed.
- Open [**Install Playwright's Chromium and its system libraries before the first e2e run**](practice-install-playwright-chromium-and-its-system-libraries-before-the-first-e2e-run.md) — A fresh container needs npx playwright install chromium plus sudo npx playwright install-deps chromium, or Chromium fails on libnspr4.so.
- Open [**Testing layers (unit + e2e)**](map-testing-layers-unit-e2e.md) — Vitest for fast unit tests; Playwright + Cucumber for webapp e2e (CI) and Electron e2e (not run in CI).
### #git
- Open [**Run npm run prepare in a fresh worktree or the pre-commit hook silently skips**](practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md) — core.hooksPath points at .husky/_, which husky generates and git never tracks, so a new worktree commits with no hook and no warning.
- Open [**Apply curator conflicts using the selected reply**](../knowledge-base/curate/practice-apply-curator-conflict-outcomes-via-targeted-git-commands.md) — Accept updates the target and removes the conflict; reject removes only the conflict.
- Open [**Review knowledge-base changes via git diff before committing**](../knowledge-base/structure/practice-review-knowledge-base-changes-via-git-diff-before-committing.md) — Curator and bootstrap writes land directly in nodes/; accept with git commit, reject with git restore.
### #strikethroo
- Open [**PRE_PLAN hook**](../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**POST_PLAN hook**](../planning/authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
### #build
- Open [**CSS build pipeline for @self-review/react**](../packages/styling/map-css-build-pipeline-for-self-review-react.md) — tsup + @tailwindcss/cli compile src/build-styles.css into dist/styles.css.
- Open [**Import only the compiled dist/styles.css from host apps**](../packages/styling/practice-import-only-the-compiled-dist-styles-css-from-host-apps.md) — src/styles.css and src/build-styles.css are build inputs only; never import them.
- Open [**Fix webpack type-checking in the root tsconfig.json, not in a webpack config**](practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config.md) — fork-ts-checker defaults configFile to <context>/tsconfig.json and all three webpack configs set context to the project root.
### #ci
- Open [**Seven tsc programs behind five typecheck npm scripts**](map-type-check-programs-and-scripts.md) — typecheck, typecheck:tests, typecheck:unit, typecheck:packages and typecheck:configs cover seven tsconfig programs; the CI lint job gates on all five.
- Open [**Check each package with its own tsconfig; the root program only follows imports**](practice-check-each-package-with-its-own-tsconfig.md) — The root program includes only src/**/*, so package files the app never imports are covered by typecheck:packages alone.
- Open [**Formatting is enforced by lint-staged and CI**](practice-formatting-is-enforced-by-lint-staged-and-ci.md) — Prettier runs on staged files via .husky/pre-commit and CI runs npm run format:check; printWidth is 100.
### #devcontainer
- Open [**Both e2e projects run in the dev container; the Electron tier needs two apt packages**](practice-run-the-webapp-e2e-project-in-the-dev-container.md) — npm run test:e2e and npm run test:e2e:electron both pass in the container once xauth and libgtk-3-0 are installed.
- Open [**Install Playwright's Chromium and its system libraries before the first e2e run**](practice-install-playwright-chromium-and-its-system-libraries-before-the-first-e2e-run.md) — A fresh container needs npx playwright install chromium plus sudo npx playwright install-deps chromium, or Chromium fails on libnspr4.so.
- Open [**Install libgtk-3-0, never libgtk-3-0t64**](practice-install-libgtk-3-0-never-libgtk-3-0t64.md) — libgtk-3-0 is virtual on Ubuntu noble but installs through Provides; the t64 spelling breaks the Debian 12 dev container.
### #husky
- Open [**Commitlint rejects agent attribution in the message and the author email**](practice-strip-agent-attribution-from-commit-messages.md) — A Co-Authored-By trailer naming an assistant fails commit-msg; so does an author email carrying an assistant keyword.
- Open [**Run npm run prepare in a fresh worktree or the pre-commit hook silently skips**](practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md) — core.hooksPath points at .husky/_, which husky generates and git never tracks, so a new worktree commits with no hook and no warning.
- Open [**Formatting is enforced by lint-staged and CI**](practice-formatting-is-enforced-by-lint-staged-and-ci.md) — Prettier runs on staged files via .husky/pre-commit and CI runs npm run format:check; printWidth is 100.
### #packaging
- Open [**Re-exec with headless Ozone for windowless subcommands**](../app/cli/practice-re-exec-with-headless-ozone-for-windowless-subcommands.md) — Packaged fuses disable RunAsNode, so ELECTRON_RUN_AS_NODE cannot make a subcommand headless; cli-dispatch re-execs.
- Open [**Upload release ZIPs using the MakerZIP filenames**](practice-upload-release-zips-using-the-makerzip-filenames.md) — Upload MakerZIP archives directly by glob without renaming them.
- Open [**asarUnpack is electron-builder's key; @electron/packager spells it asar.unpack**](practice-use-asar-unpack-not-asarunpack-in-forge-config.md) — Forge drops an asarUnpack key on the floor. The packager option is asar: { unpack }, and this repo needs neither.
### #tooling
- Open [**Keep extra worktrees out of the repo root**](practice-keep-extra-worktrees-out-of-the-repo-root.md) — ESLint and Prettier walk a nested worktree even when git excludes it, and a hardlinked node_modules is shared.
- Open [**Exclude generated assistant tooling from ESLint**](practice-exclude-generated-assistant-tooling-from-eslint.md) — Ignore bundled assistant tooling directories in ESLint.
- Open [**Write node_modules without a trailing slash in .gitignore**](practice-write-node-modules-without-a-trailing-slash-in-gitignore.md) — A trailing slash matches directories only, so the symlinked node_modules a prepared worktree gets shows up as untracked.
### #tsconfig
- Open [**Seven tsc programs behind five typecheck npm scripts**](map-type-check-programs-and-scripts.md) — typecheck, typecheck:tests, typecheck:unit, typecheck:packages and typecheck:configs cover seven tsconfig programs; the CI lint job gates on all five.
- Open [**Check each package with its own tsconfig; the root program only follows imports**](practice-check-each-package-with-its-own-tsconfig.md) — The root program includes only src/**/*, so package files the app never imports are covered by typecheck:packages alone.
- Open [**Fix webpack type-checking in the root tsconfig.json, not in a webpack config**](practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config.md) — fork-ts-checker defaults configFile to <context>/tsconfig.json and all three webpack configs set context to the project root.
### #typescript
- Open [**Seven tsc programs behind five typecheck npm scripts**](map-type-check-programs-and-scripts.md) — typecheck, typecheck:tests, typecheck:unit, typecheck:packages and typecheck:configs cover seven tsconfig programs; the CI lint job gates on all five.
- Open [**Check each package with its own tsconfig; the root program only follows imports**](practice-check-each-package-with-its-own-tsconfig.md) — The root program includes only src/**/*, so package files the app never imports are covered by typecheck:packages alone.
- Open [**Fix webpack type-checking in the root tsconfig.json, not in a webpack config**](practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config.md) — fork-ts-checker defaults configFile to <context>/tsconfig.json and all three webpack configs set context to the project root.
### #worktree
- Open [**Write node_modules without a trailing slash in .gitignore**](practice-write-node-modules-without-a-trailing-slash-in-gitignore.md) — A trailing slash matches directories only, so the symlinked node_modules a prepared worktree gets shows up as untracked.
- Open [**Keep extra worktrees out of the repo root**](practice-keep-extra-worktrees-out-of-the-repo-root.md) — ESLint and Prettier walk a nested worktree even when git excludes it, and a hardlinked node_modules is shared.
- Open [**Run npm run prepare in a fresh worktree or the pre-commit hook silently skips**](practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md) — core.hooksPath points at .husky/_, which husky generates and git never tracks, so a new worktree commits with no hook and no warning.
### #e2e
- Open [**Both e2e projects run in the dev container; the Electron tier needs two apt packages**](practice-run-the-webapp-e2e-project-in-the-dev-container.md) — npm run test:e2e and npm run test:e2e:electron both pass in the container once xauth and libgtk-3-0 are installed.
- Open [**Install Playwright's Chromium and its system libraries before the first e2e run**](practice-install-playwright-chromium-and-its-system-libraries-before-the-first-e2e-run.md) — A fresh container needs npx playwright install chromium plus sudo npx playwright install-deps chromium, or Chromium fails on libnspr4.so.
### #electron
- Open [**Re-exec with headless Ozone for windowless subcommands**](../app/cli/practice-re-exec-with-headless-ozone-for-windowless-subcommands.md) — Packaged fuses disable RunAsNode, so ELECTRON_RUN_AS_NODE cannot make a subcommand headless; cli-dispatch re-execs.
- Open [**asarUnpack is electron-builder's key; @electron/packager spells it asar.unpack**](practice-use-asar-unpack-not-asarunpack-in-forge-config.md) — Forge drops an asarUnpack key on the floor. The packager option is asar: { unpack }, and this repo needs neither.
- Open [**Two-process Electron architecture**](../app/architecture/map-two-process-electron-architecture.md) — Main process runs CLI/git/IPC/file I/O; renderer is a React + TypeScript UI sandboxed via preload contextBridge.
### #hooks
- Open [**PRE_PLAN hook**](../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**PRE_TASK_ASSIGNMENT hook**](../planning/assignment/map-pre-task-assignment-hook.md) — Match task skills and domain to available agents in the active harness.
### #lint
- Open [**Keep extra worktrees out of the repo root**](practice-keep-extra-worktrees-out-of-the-repo-root.md) — ESLint and Prettier walk a nested worktree even when git excludes it, and a hardlinked node_modules is shared.
- Open [**Exclude generated assistant tooling from ESLint**](practice-exclude-generated-assistant-tooling-from-eslint.md) — Ignore bundled assistant tooling directories in ESLint.
### #playwright
- Open [**Both e2e projects run in the dev container; the Electron tier needs two apt packages**](practice-run-the-webapp-e2e-project-in-the-dev-container.md) — npm run test:e2e and npm run test:e2e:electron both pass in the container once xauth and libgtk-3-0 are installed.
- Open [**Install Playwright's Chromium and its system libraries before the first e2e run**](practice-install-playwright-chromium-and-its-system-libraries-before-the-first-e2e-run.md) — A fresh container needs npx playwright install chromium plus sudo npx playwright install-deps chromium, or Chromium fails on libnspr4.so.
### #scope
- Open [**Default bootstrap scope**](../knowledge-base/bootstrap/discovery/map-default-bootstrap-scope.md) — Without a scope argument, finddocs scans from the repository root.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../knowledge-base/bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Skip files that look correct rather than forcing comments**](../skills/critique/review-strategy/practice-skip-files-that-look-correct-rather-than-forcing-comments.md) — Critique should leave a file un-commented when nothing substantive is wrong; do not manufacture review comments on every file.
### #typecheck
- Open [**Seven tsc programs behind five typecheck npm scripts**](map-type-check-programs-and-scripts.md) — typecheck, typecheck:tests, typecheck:unit, typecheck:packages and typecheck:configs cover seven tsconfig programs; the CI lint job gates on all five.
- Open [**Check each package with its own tsconfig; the root program only follows imports**](practice-check-each-package-with-its-own-tsconfig.md) — The root program includes only src/**/*, so package files the app never imports are covered by typecheck:packages alone.
### #webpack
- Open [**Check the existing Forge bundler before changing build tooling**](practice-do-not-install-or-use-webpack.md) — Forge is the build entry point; bundling changes belong in the three webpack configs its plugin points at.
- Open [**Fix webpack type-checking in the root tsconfig.json, not in a webpack config**](practice-fix-webpack-type-checking-in-the-root-tsconfig-json-not-in-a-webpack-config.md) — fork-ts-checker defaults configFile to <context>/tsconfig.json and all three webpack configs set context to the project root.
### #apt
- Open [**Install libgtk-3-0, never libgtk-3-0t64**](practice-install-libgtk-3-0-never-libgtk-3-0t64.md) — libgtk-3-0 is virtual on Ubuntu noble but installs through Provides; the t64 spelling breaks the Debian 12 dev container.
### #asar
- Open [**asarUnpack is electron-builder's key; @electron/packager spells it asar.unpack**](practice-use-asar-unpack-not-asarunpack-in-forge-config.md) — Forge drops an asarUnpack key on the floor. The packager option is asar: { unpack }, and this repo needs neither.
### #code-quality
- Open [**Favor simple, maintainable solutions over clever ones**](practice-favor-simple-maintainable-solutions-over-clever-ones.md) — Choose the most straightforward approach. Use standard patterns, minimal dependencies, and readable code over complex abstractions.
### #code-reuse
- Open [**Extract shared logic before duplicating across call sites**](practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
- Open [**Keep architecture decisions within the requested plan scope**](../planning/authoring/practice-check-plans-for-architecture-and-code-reuse-improvements.md) — Use PRE_PLAN simplicity and scope rules when evaluating abstractions.
### #commitlint
- Open [**Commitlint rejects agent attribution in the message and the author email**](practice-strip-agent-attribution-from-commit-messages.md) — A Co-Authored-By trailer naming an assistant fails commit-msg; so does an author email carrying an assistant keyword.
### #commits
- Open [**Complete configured checks and commit each phase**](../planning/execution/practice-pass-linting-and-create-a-descriptive-conventional-commit-at-the-end-of-each-phase.md) — Run checks defined by the phase hook and create a descriptive conventional commit.
- Open [**Commitlint rejects agent attribution in the message and the author email**](practice-strip-agent-attribution-from-commit-messages.md) — A Co-Authored-By trailer naming an assistant fails commit-msg; so does an author email carrying an assistant keyword.
### #conventional-commits
- Open [**Use conventional commit naming for PR titles**](practice-use-conventional-commit-naming-for-pr-titles.md) — PR titles must follow the conventional commit convention.
### #debian
- Open [**Install libgtk-3-0, never libgtk-3-0t64**](practice-install-libgtk-3-0-never-libgtk-3-0t64.md) — libgtk-3-0 is virtual on Ubuntu noble but installs through Provides; the t64 spelling breaks the Debian 12 dev container.
### #docs
- Open [**Lead each platform installation section with Homebrew**](practice-lead-each-platform-installation-section-with-homebrew.md) — Document Homebrew first within each platform section; collapse manual instructions.
### #duplication
- Open [**Extract shared logic before duplicating across call sites**](practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
- Open [**Keep file-type detection utilities duplicated across core and react packages**](../packages/architecture/practice-keep-file-type-detection-utilities-duplicated-across-core-and-react-packages.md) — getRenderedTextMode, isPreviewableImage, isPreviewableSvg, getLanguageFromPath are intentionally duplicated.
- Open [**Use src/shared/types.ts as the single source of truth for shared types**](../app/architecture/practice-use-src-shared-types-ts-as-the-single-source-of-truth-for-shared-types.md) — All main and renderer code imports shared types from src/shared/types.ts; never duplicate definitions.
### #flake
- Open [**Pin Nix fetchzip hashes to the unpacked directory**](practice-pin-nix-fetchzip-hashes-to-the-unpacked-directory.md) — A fetchzip hash covers the unpacked tree, never the archive bytes; update-flake-hash.sh prefetches with --unpack.
### #forge
- Open [**asarUnpack is electron-builder's key; @electron/packager spells it asar.unpack**](practice-use-asar-unpack-not-asarunpack-in-forge-config.md) — Forge drops an asarUnpack key on the floor. The packager option is asar: { unpack }, and this repo needs neither.
### #formatting
- Open [**Formatting is enforced by lint-staged and CI**](practice-formatting-is-enforced-by-lint-staged-and-ci.md) — Prettier runs on staged files via .husky/pre-commit and CI runs npm run format:check; printWidth is 100.
### #gitignore
- Open [**Write node_modules without a trailing slash in .gitignore**](practice-write-node-modules-without-a-trailing-slash-in-gitignore.md) — A trailing slash matches directories only, so the symlinked node_modules a prepared worktree gets shows up as untracked.
### #gotcha
- Open [**Run npm run prepare in a fresh worktree or the pre-commit hook silently skips**](practice-run-npm-run-prepare-in-a-fresh-worktree-or-the-pre-commit-hook-is-silently-skipped.md) — core.hooksPath points at .husky/_, which husky generates and git never tracks, so a new worktree commits with no hook and no warning.
- Open [**Put work that needs the reviewed diff after loadDiff in bootstrapRemoteDiff**](../packages/architecture/practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff.md) — startRemoteSession runs before any diff exists; anything that anchors against files belongs in bootstrapRemoteDiff after loadDiff.
### #hermetic-tests
- Open [**Scrub git's repository env vars before spawning git in tests**](practice-scrub-git-repository-env-vars-before-spawning-git-in-tests.md) — Git's hook environment outranks cwd and git -C; packages/core/vitest.setup.ts strips it so suites stay hermetic.
### #installation
- Open [**Lead each platform installation section with Homebrew**](practice-lead-each-platform-installation-section-with-homebrew.md) — Document Homebrew first within each platform section; collapse manual instructions.
### #jsdom
- Open [**Drive resizable panels through the imperative handle in jsdom**](practice-drive-resizable-panels-through-the-imperative-handle-in-jsdom.md) — react-resizable-panels needs a ResizeObserver stub under jsdom and never fires onResize there.
### #layers
- Open [**Testing layers (unit + e2e)**](map-testing-layers-unit-e2e.md) — Vitest for fast unit tests; Playwright + Cucumber for webapp e2e (CI) and Electron e2e (not run in CI).
### #maintainability
- Open [**Favor simple, maintainable solutions over clever ones**](practice-favor-simple-maintainable-solutions-over-clever-ones.md) — Choose the most straightforward approach. Use standard patterns, minimal dependencies, and readable code over complex abstractions.
### #nix
- Open [**Pin Nix fetchzip hashes to the unpacked directory**](practice-pin-nix-fetchzip-hashes-to-the-unpacked-directory.md) — A fetchzip hash covers the unpacked tree, never the archive bytes; update-flake-hash.sh prefetches with --unpack.
### #node-modules
- Open [**Keep extra worktrees out of the repo root**](practice-keep-extra-worktrees-out-of-the-repo-root.md) — ESLint and Prettier walk a nested worktree even when git excludes it, and a hardlinked node_modules is shared.
### #packages
- Open [**@self-review/types package**](../packages/types/map-self-review-types-package.md) — Shared TypeScript type definitions for the self-review workspace, with zero runtime dependencies.
- Open [**Keep @self-review/types free of runtime dependencies**](../packages/types/practice-keep-self-review-types-free-of-runtime-dependencies.md) — The types package must never add runtime dependencies in package.json; it exists solely for type exports.
- Open [**npm workspaces packages**](../packages/architecture/map-npm-workspaces-packages.md) — Reusable packages: @self-review/core (logic), @self-review/react (UI), @self-review/types (shared types).
### #panels
- Open [**Restore collapsed panels inside flushSync**](../app/ui/interactions/practice-restore-collapsed-panels-inside-flushsync.md) — react-resizable-panels' expand() only writes to its store; flush the render before measuring rects.
- Open [**Drive resizable panels through the imperative handle in jsdom**](practice-drive-resizable-panels-through-the-imperative-handle-in-jsdom.md) — react-resizable-panels needs a ResizeObserver stub under jsdom and never fires onResize there.
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
### #prettier
- Open [**Formatting is enforced by lint-staged and CI**](practice-formatting-is-enforced-by-lint-staged-and-ci.md) — Prettier runs on staged files via .husky/pre-commit and CI runs npm run format:check; printWidth is 100.
### #react
- Open [**Restore collapsed panels inside flushSync**](../app/ui/interactions/practice-restore-collapsed-panels-inside-flushsync.md) — react-resizable-panels' expand() only writes to its store; flush the render before measuring rects.
- Open [**Drive resizable panels through the imperative handle in jsdom**](practice-drive-resizable-panels-through-the-imperative-handle-in-jsdom.md) — react-resizable-panels needs a ResizeObserver stub under jsdom and never fires onResize there.
- Open [**@self-review/react package**](../packages/architecture/map-self-review-react-package.md) — Embeddable React UI layer: diff viewer, file tree, commenting, syntax highlighting.
### #release
- Open [**Upload release ZIPs using the MakerZIP filenames**](practice-upload-release-zips-using-the-makerzip-filenames.md) — Upload MakerZIP archives directly by glob without renaming them.
### #root-cause
- Open [**Fix the root cause in tests, never write test-specific code in production**](practice-fix-the-root-cause-in-tests-never-write-test-specific-code-in-production.md) — No environment detection, no conditional test bypasses; green tests must mean the code actually works.
### #security
- Open [**Never import electron directly in the renderer**](../app/architecture/practice-never-import-electron-directly-in-the-renderer.md) — Renderer must only access IPC via the preload contextBridge electronAPI object.
- Open [**Spawn git with an argv array, never a shell string**](practice-spawn-git-with-an-argv-array-never-a-shell-string.md) — Diff arguments reach git through execFile; joining argv into a command line let a command substitution run.
### #setup
- Open [**Install Playwright's Chromium and its system libraries before the first e2e run**](practice-install-playwright-chromium-and-its-system-libraries-before-the-first-e2e-run.md) — A fresh container needs npx playwright install chromium plus sudo npx playwright install-deps chromium, or Chromium fails on libnspr4.so.
### #shell-injection
- Open [**Spawn git with an argv array, never a shell string**](practice-spawn-git-with-an-argv-array-never-a-shell-string.md) — Diff arguments reach git through execFile; joining argv into a command line let a command substitution run.
### #simplicity
- Open [**Favor simple, maintainable solutions over clever ones**](practice-favor-simple-maintainable-solutions-over-clever-ones.md) — Choose the most straightforward approach. Use standard patterns, minimal dependencies, and readable code over complex abstractions.
### #subprocess
- Open [**Spawn git with an argv array, never a shell string**](practice-spawn-git-with-an-argv-array-never-a-shell-string.md) — Diff arguments reach git through execFile; joining argv into a command line let a command substitution run.
### #ubuntu
- Open [**Install libgtk-3-0, never libgtk-3-0t64**](practice-install-libgtk-3-0-never-libgtk-3-0t64.md) — libgtk-3-0 is virtual on Ubuntu noble but installs through Provides; the t64 spelling breaks the Debian 12 dev container.
### #xmllint
- Open [**Validate self-review XML against the XSD before applying**](../skills/apply/practice-validate-self-review-xml-against-the-xsd-before-applying.md) — Run xmllint against assets/self-review-v3.xsd before processing review feedback; stop on failure.
- Open [**asarUnpack is electron-builder's key; @electron/packager spells it asar.unpack**](practice-use-asar-unpack-not-asarunpack-in-forge-config.md) — Forge drops an asarUnpack key on the floor. The packager option is asar: { unpack }, and this repo needs neither.
### #yagni
- Open [**Implement only what the user explicitly requests**](practice-implement-only-what-the-user-explicitly-requests.md) — Build the minimal viable solution. Don't add features, abstractions, or backwards compatibility unless asked.