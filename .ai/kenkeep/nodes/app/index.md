# kenkeep Index: app

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
- Load [`architecture/`](architecture/index.md) for more information on the two-process Electron model, IPC channel contract, renderer state rules, and large-payload lazy loading; read when changing the main/renderer boundary or how diffs are delivered.
- Load [`cli/`](cli/index.md) for more information on CLI invocation, startup modes, resume, and stderr-only logging; read when changing how the app is launched or what it emits.
- Load [`config/`](config/index.md) for more information on the user and project .self-review.yaml files and their precedence rules; read when adding or resolving a configuration option.
- Load [`ui/`](ui/index.md) for more information on diff viewer rendering, rendered file previews, keyboard navigation, comment editing, and exit UX; read when changing renderer components or review interactions.

## Conventions (how we build)
- Open [**Keep self-review local-only with no network access**](practice-keep-self-review-local-only-with-no-network-access.md) to learn about: No network access, no accounts, no telemetry. Code stays on the user's machine. #privacy #network #local
- Open [**Limit file writes to the review XML and assets directory**](practice-limit-file-writes-to-the-review-xml-and-assets-directory.md) to learn about: App only writes the configured output XML file and a sibling .self-review-assets/ directory for image attachments. #task-manager #filesystem #scope
- Open [**Make no network connections at runtime**](practice-make-no-network-connections-at-runtime.md) to learn about: The app is fully local: no network calls, no telemetry, no analytics, no CDN fetches. #network #privacy #local-only
- Open [**Make zero network requests except the startup version check**](practice-make-zero-network-requests-except-the-startup-version-check.md) to learn about: No telemetry, analytics, or CDN fetches; only a fire-and-forget GitHub Releases check at startup. #task-manager #network #privacy

## Components (what exists)
- Open [**self-review**](map-self-review.md) to learn about: Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews. #task-manager #app #overview
- Open [**self-review application**](map-self-review-application.md) to learn about: Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews. #overview #app

## By topic

### #network
- Open [**Keep self-review local-only with no network access**](practice-keep-self-review-local-only-with-no-network-access.md) — No network access, no accounts, no telemetry. Code stays on the user's machine.
- Open [**Make no network connections at runtime**](practice-make-no-network-connections-at-runtime.md) — The app is fully local: no network calls, no telemetry, no analytics, no CDN fetches.
- Open [**Make zero network requests except the startup version check**](practice-make-zero-network-requests-except-the-startup-version-check.md) — No telemetry, analytics, or CDN fetches; only a fire-and-forget GitHub Releases check at startup.
### #privacy
- Open [**Keep self-review local-only with no network access**](practice-keep-self-review-local-only-with-no-network-access.md) — No network access, no accounts, no telemetry. Code stays on the user's machine.
- Open [**Make no network connections at runtime**](practice-make-no-network-connections-at-runtime.md) — The app is fully local: no network calls, no telemetry, no analytics, no CDN fetches.
- Open [**Make zero network requests except the startup version check**](practice-make-zero-network-requests-except-the-startup-version-check.md) — No telemetry, analytics, or CDN fetches; only a fire-and-forget GitHub Releases check at startup.
### #task-manager
- Open [**POST_PHASE hook**](../planning/map-post-phase-hook.md) — Task-manager hook that runs after each phase to enforce linting, conventional commits, and blueprint progress updates.
- Open [**PRE_PLAN hook**](../planning/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**Extract shared logic before duplicating across call sites**](../engineering/practice-extract-shared-logic-before-duplicating-across-call-sites.md) — Refactor existing code into reusable utilities before building overlapping features; never copy-paste and modify.
### #app
- Open [**self-review**](map-self-review.md) — Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews.
- Open [**self-review application**](map-self-review-application.md) — Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews.
### #overview
- Open [**self-review**](map-self-review.md) — Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews.
- Open [**self-review application**](map-self-review-application.md) — Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews.
### #filesystem
- Open [**Limit file writes to the review XML and assets directory**](practice-limit-file-writes-to-the-review-xml-and-assets-directory.md) — App only writes the configured output XML file and a sibling .self-review-assets/ directory for image attachments.
### #local
- Open [**Keep self-review local-only with no network access**](practice-keep-self-review-local-only-with-no-network-access.md) — No network access, no accounts, no telemetry. Code stays on the user's machine.
### #local-only
- Open [**Make no network connections at runtime**](practice-make-no-network-connections-at-runtime.md) — The app is fully local: no network calls, no telemetry, no analytics, no CDN fetches.
### #scope
- Open [**Default bootstrap scope**](../knowledge-base/bootstrap/map-default-bootstrap-scope.md) — With no path argument, kb-bootstrap scans \`docs/\`, top-level README, CONTRIBUTING, ARCHITECTURE, and root-level \`*.md\` files.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../knowledge-base/bootstrap/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Skip files that look correct rather than forcing comments**](../skills/critique/practice-skip-files-that-look-correct-rather-than-forcing-comments.md) — Critique should leave a file un-commented when nothing substantive is wrong; do not manufacture review comments on every file.