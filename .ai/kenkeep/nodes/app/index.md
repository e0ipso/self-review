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
- Open [**Limit file writes to the review XML and assets directory**](practice-limit-file-writes-to-the-review-xml-and-assets-directory.md) to learn about: App writes only the output XML, a sibling .self-review-assets/ directory, and (remote mode) a temporary clone under the OS temp dir, removed on exit. #strikethroo #filesystem #scope
- Open [**Keep self-review local-only with no network access**](practice-keep-self-review-local-only-with-no-network-access.md) to learn about: No network access, no accounts, no telemetry. Code stays on the user's machine. #privacy #network #local
- Open [**Make no network connections at runtime**](practice-make-no-network-connections-at-runtime.md) to learn about: The app is local-first: no network calls except the startup version check and user-triggered remote PR/MR review; nothing is sent to the forge. #network #privacy #local-only
- Open [**Make zero network requests except the startup version check**](practice-make-zero-network-requests-except-the-startup-version-check.md) to learn about: No telemetry, analytics, or CDN fetches; only the startup version check and user-triggered remote PR/MR review touch the network. #strikethroo #network #privacy

## Components (what exists)
- Open [**self-review**](map-self-review.md) to learn about: Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews. #strikethroo #app #overview
- Open [**self-review application**](map-self-review-application.md) to learn about: Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews. #overview #app
- Open [**Suggestion-apply write boundary**](map-suggestion-apply-write-boundary.md) to learn about: applySuggestion does the byte-compare and the write; resolveApplyDestination and setApplyDestination decide where, and never inside a temporary clone. #core #apply-suggestion #file-writes #remote-mode

## By topic

### #network
- Open [**Keep self-review local-only with no network access**](practice-keep-self-review-local-only-with-no-network-access.md) — No network access, no accounts, no telemetry. Code stays on the user's machine.
- Open [**Make no network connections at runtime**](practice-make-no-network-connections-at-runtime.md) — The app is local-first: no network calls except the startup version check and user-triggered remote PR/MR review; nothing is sent to the forge.
- Open [**Make zero network requests except the startup version check**](practice-make-zero-network-requests-except-the-startup-version-check.md) — No telemetry, analytics, or CDN fetches; only the startup version check and user-triggered remote PR/MR review touch the network.
### #privacy
- Open [**Keep self-review local-only with no network access**](practice-keep-self-review-local-only-with-no-network-access.md) — No network access, no accounts, no telemetry. Code stays on the user's machine.
- Open [**Make no network connections at runtime**](practice-make-no-network-connections-at-runtime.md) — The app is local-first: no network calls except the startup version check and user-triggered remote PR/MR review; nothing is sent to the forge.
- Open [**Make zero network requests except the startup version check**](practice-make-zero-network-requests-except-the-startup-version-check.md) — No telemetry, analytics, or CDN fetches; only the startup version check and user-triggered remote PR/MR review touch the network.
### #strikethroo
- Open [**PRE_PLAN hook**](../planning/authoring/map-pre-plan-hook.md) — Pre-planning hook that establishes scope control, simplicity principles, and PRD-only output before plan creation.
- Open [**POST_PHASE hook**](../planning/execution/map-post-phase-hook.md) — Create a phase commit and update blueprint progress before advancing.
- Open [**POST_PLAN hook**](../planning/authoring/map-post-plan-hook.md) — Require self-validation steps and decide whether docs or AGENTS.md need updates.
### #app
- Open [**self-review**](map-self-review.md) — Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews.
- Open [**self-review application**](map-self-review-application.md) — Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews.
### #overview
- Open [**self-review**](map-self-review.md) — Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews.
- Open [**self-review application**](map-self-review-application.md) — Local-only Electron desktop app providing a GitHub-style PR review UI for local git diffs and directory reviews.
### #apply-suggestion
- Open [**Split file text on \\n only and keep each line's trailing \\r**](../packages/architecture/practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r.md) — apply-suggestion, the diff parser and the thread mapper all carry a CRLF file's \\r inside the line, which is what makes the byte compare work.
- Open [**Suggestion-apply write boundary**](map-suggestion-apply-write-boundary.md) — applySuggestion does the byte-compare and the write; resolveApplyDestination and setApplyDestination decide where, and never inside a temporary clone.
### #core
- Open [**Suggestion-apply write boundary**](map-suggestion-apply-write-boundary.md) — applySuggestion does the byte-compare and the write; resolveApplyDestination and setApplyDestination decide where, and never inside a temporary clone.
- Open [**Split file text on \\n only and keep each line's trailing \\r**](../packages/architecture/practice-split-file-text-on-n-only-and-keep-each-line-s-trailing-r.md) — apply-suggestion, the diff parser and the thread mapper all carry a CRLF file's \\r inside the line, which is what makes the byte compare work.
- Open [**Put work that needs the reviewed diff after loadDiff in bootstrapRemoteDiff**](../packages/architecture/practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff.md) — startRemoteSession runs before any diff exists; anything that anchors against files belongs in bootstrapRemoteDiff after loadDiff.
### #file-writes
- Open [**Suggestion-apply write boundary**](map-suggestion-apply-write-boundary.md) — applySuggestion does the byte-compare and the write; resolveApplyDestination and setApplyDestination decide where, and never inside a temporary clone.
### #filesystem
- Open [**Limit file writes to the review XML and assets directory**](practice-limit-file-writes-to-the-review-xml-and-assets-directory.md) — App writes only the output XML, a sibling .self-review-assets/ directory, and (remote mode) a temporary clone under the OS temp dir, removed on exit.
### #local
- Open [**Keep self-review local-only with no network access**](practice-keep-self-review-local-only-with-no-network-access.md) — No network access, no accounts, no telemetry. Code stays on the user's machine.
### #local-only
- Open [**Make no network connections at runtime**](practice-make-no-network-connections-at-runtime.md) — The app is local-first: no network calls except the startup version check and user-triggered remote PR/MR review; nothing is sent to the forge.
### #remote-mode
- Open [**Suggestion-apply write boundary**](map-suggestion-apply-write-boundary.md) — applySuggestion does the byte-compare and the write; resolveApplyDestination and setApplyDestination decide where, and never inside a temporary clone.
- Open [**Put work that needs the reviewed diff after loadDiff in bootstrapRemoteDiff**](../packages/architecture/practice-put-work-that-needs-the-reviewed-diff-after-loaddiff-in-bootstrapremotediff.md) — startRemoteSession runs before any diff exists; anything that anchors against files belongs in bootstrapRemoteDiff after loadDiff.
### #scope
- Open [**Default bootstrap scope**](../knowledge-base/bootstrap/discovery/map-default-bootstrap-scope.md) — Without a scope argument, finddocs scans from the repository root.
- Open [**Stick to markdown documentation; do not read code files during bootstrap**](../knowledge-base/bootstrap/discovery/practice-stick-to-markdown-documentation-do-not-read-code-files-during-bootstrap.md) — Bootstrap extracts what's already been written down — read only markdown docs, not source code.
- Open [**Skip files that look correct rather than forcing comments**](../skills/critique/review-strategy/practice-skip-files-that-look-correct-rather-than-forcing-comments.md) — Critique should leave a file un-commented when nothing substantive is wrong; do not manufacture review comments on every file.