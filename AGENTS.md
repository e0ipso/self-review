# self-review

A local review app for solo developers checking AI-generated code. It reviews git diffs, files,
directories, and remote GitHub PRs or GitLab MRs, then saves feedback as XML. The Electron desktop
app and the loopback HTTP CLI share the same review engine and React UI. Supported platforms are
macOS and Linux; Windows is out of scope.

## Start here

<!-- >>> kenkeep:kk-index >>> -->

You are required to load [.ai/kenkeep/ENTRY.md](.ai/kenkeep/ENTRY.md), the small curated entry
catalog for this repo. Enter there and descend using progressive disclosure principles.

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of
> branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand.
> Read the root index node, pick one or more branches whose intent and tags match your task (several
> branches can be relevant), and read those branch `index.md` nodes. Descend further only where the
> task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's
> `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide
> how deep to go per branch.

<!-- <<< kenkeep:kk-index <<< -->

- [docs/PRD.md](docs/PRD.md) is the product requirements source of truth.
- [README.md](README.md) documents installation, usage, configuration, and assistant skills.
- Kenkeep nodes are knowledge snapshots. Verify named paths, functions, and flags against the live
  tree before relying on them. Prefer live code and report stale nodes when they disagree.
- Read the package's instructions before changing it: [core](packages/core/AGENTS.md),
  [react](packages/react/AGENTS.md), [types](packages/types/AGENTS.md). The HTTP CLI is documented
  in [packages/serve/README.md](packages/serve/README.md).
- Keep this file focused on actionable repository guidance. Put feature descriptions in the existing
  docs, and package details in the relevant package's `AGENTS.md`. Avoid historical test counts,
  timings, commit hashes, and fixed line-number references.
- Preserve Kenkeep's managed block. Link to its branch indexes instead of copying their catalogs
  into this file; follow the entry catalog for planning and knowledge-base maintenance.

## Environment

This repository can be developed on a host machine, in its optional dev container, or in a cloud VM.
The presence of `.devcontainer/` does not establish where the current agent is running. Check the
session's environment and available tools before choosing a launch or test command. A machine
without a physical monitor may still have a usable graphical session or virtual display; verify
display access before reporting that GUI work is unavailable.

- Use Node.js 24, matching CI and the dev container, and npm workspaces. Install dependencies with
  `npm ci`.
- Desktop launch and packaging scripts build the workspace packages automatically. Use
  `npm run build:packages` when only the package outputs are needed.
- For Playwright webapp and serve tests, install Chromium with `npx playwright install chromium`. On
  Linux, install missing system libraries with `npx playwright install-deps chromium`, using
  elevated privileges if required.
- On Linux, `npm run test:e2e:electron` packages the app and uses `xvfb-run --auto-servernum`, which
  starts its own X server. An unset `DISPLAY` alone does not prevent this suite from running. It
  needs `xvfb`, `xauth`, and GTK 3; the dev container config explicitly installs `xauth` and
  `libgtk-3-0`. Diagnose missing dependencies from the launch error.
- A Linux host without `xvfb-run` can use an available X display. Run `npm run package` and
  `npx bddgen`, then
  `env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 DISPLAY=:0 npx playwright test --project electron`,
  replacing `:0` with the actual display. The overrides keep Chromium from choosing Wayland. CI
  continues to use Xvfb.
- Only in a Cursor Cloud Agent VM, read
  [.cursor/cloud-instructions.md](.cursor/cloud-instructions.md) for its environment-specific setup.
  Verify its examples against the current scripts and environment.

## Commands and verification

Run commands from the repository root. Use [package.json](package.json) for the complete script
list.

Read the relevant leaves under Kenkeep's [engineering index](.ai/kenkeep/nodes/engineering/index.md)
for implementation and testing conventions.

| Command                                            | Purpose                                                    |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `npm start`                                        | Build packages and launch Electron in development          |
| `npm run start:serve`                              | Build and run the HTTP CLI                                 |
| `npm run package`                                  | Build packages and package Electron through Forge          |
| `npm run lint`                                     | Run ESLint                                                 |
| `npx prettier --check <files>`                     | Check formatting of changed files                          |
| `npm run format:check`                             | Check formatting across the repository                     |
| `npm run typecheck`                                | Check app types                                            |
| `npm run typecheck:tests`                          | Check e2e test types                                       |
| `npm run typecheck:unit`                           | Check unit test types                                      |
| `npm run typecheck:packages`                       | Check workspace package types                              |
| `npm run typecheck:configs`                        | Check build and test config types                          |
| `npm run test:unit`                                | Run main, renderer, core, and serve unit suites once       |
| `npm run test:unit --workspace @self-review/core`  | Run core unit tests once                                   |
| `npm run test:unit --workspace @self-review/serve` | Run serve unit tests once                                  |
| `npm run test:e2e`                                 | Run webapp Playwright/Cucumber scenarios                   |
| `npm run test:e2e:serve`                           | Build serve and run its Playwright specs                   |
| `npm run test:e2e:electron`                        | Package Electron and run its Playwright/Cucumber scenarios |

- Choose checks appropriate to the changed behavior. Verify fresh results before claiming success.
  Documentation-only edits need formatting and reference checks, not application test suites.
- `test:unit:main` and `test:unit:renderer` start watch mode. For a focused one-shot run, use
  `npx vitest run --config vitest.config.main.ts` or
  `npx vitest run --config vitest.config.renderer.ts`, optionally followed by a test path.
- Colocate unit tests with source. Test observable behavior, state transitions, and real input
  fixtures. Mock external boundaries when appropriate; preserve real-git and real-listener tests
  where integration behavior is the subject. Never add production bypasses to make tests pass.
- CI runs lint, formatting, all five type checks, unit tests, webapp e2e, and serve e2e. Electron
  e2e runs on pushes to `main` and manual dispatch, not on PRs. See
  [.github/workflows/ci.yml](.github/workflows/ci.yml) for the current gates.
- The serve/desktop output comparison needs a packaged app and a display. It skips without the app
  unless `SELF_REVIEW_REQUIRE_DESKTOP=1`; use Xvfb on Linux when no usable display is available.
- Follow `.prettierrc`. Format only the files you change. The pre-commit hook runs `lint-staged`,
  lint, and unit tests. Respect `.prettierignore`, especially vendored skills, managed knowledge,
  and harness symlinks.

## Architecture and code ownership

Use Kenkeep's [packages index](.ai/kenkeep/nodes/packages/index.md) for package boundaries and
styling, and its [app architecture index](.ai/kenkeep/nodes/app/architecture/index.md) for process,
IPC, and state contracts. Descend to the leaves relevant to the change.

| Location                      | Responsibility                                                              |
| ----------------------------- | --------------------------------------------------------------------------- |
| `packages/types/src/index.ts` | Canonical shared types; zero runtime dependencies                           |
| `packages/core/src/`          | Node-only review engine, git, configuration, XML, and filesystem operations |
| `packages/react/src/`         | Browser-safe review UI, React context, hooks, and components                |
| `packages/serve/src/`         | HTTP CLI, loopback transport, lifecycle, and browser adapter                |
| `src/main/`                   | Electron startup, windows, menus, dialogs, IPC, and quit handling           |
| `src/preload/preload.ts`      | Typed `electronAPI` exposed through `contextBridge`                         |
| `src/renderer/`               | Electron shell and adapter around the shared React UI                       |
| `src/shared/`                 | Desktop type re-exports and IPC channel constants                           |

- Put shared handler logic in `packages/core/src/review-handlers.ts`. Handlers take a
  `ReviewSession` explicitly and read no module-scope session state. Electron IPC registrations
  belong in `src/main/ipc-handlers.ts`; HTTP routes belong in `packages/serve/src/server.ts`.
- Use `packages/core/src/startup.ts` for shared startup decisions, configuration provenance, output
  trust, diff arguments, local loading, and resume. Keep intentional CLI differences there.
- Import desktop shared types through `src/shared/types.ts`, which re-exports the canonical types
  package. Never duplicate type definitions. Use `src/shared/ipc-channels.ts` for IPC constants.
- Keep Node and Electron APIs out of browser code. The renderer uses the preload bridge, ES module
  imports, and `ReviewAdapter`. Do not enable `nodeIntegration`, use renderer `require()`, or add
  browser storage. Keep review state in React context.
- The desktop imports workspace source by relative paths. Serve uses installed workspace packages.
  Preserve those boundaries and the documented exceptions in the package instructions.
- Extract shared logic before extending overlapping functionality. Prefer small, focused functions
  and straightforward solutions. Keep the intentionally duplicated file-type utilities in core and
  react synchronized. Keep `packages/react/src/config-defaults.ts` browser-safe and pure data.
- Use Electron Forge as the desktop build entry point. Bundling changes belong in its referenced
  `webpack.main.config.ts`, `webpack.renderer.config.ts`, and `webpack.preload.config.ts`.
- Use shadcn/ui for interactive controls, Prism for syntax highlighting, and the existing MDEditor
  for comment bodies. Suggestion code editors use shadcn `Textarea`. Suppress review shortcuts while
  a text input has focus.

## Runtime guarantees

These constrain application behavior, not the development agent's tools.

Kenkeep's [app index](.ai/kenkeep/nodes/app/index.md) routes to runtime boundaries and feature
contracts, including CLI, configuration, and UI behavior.

- Write review XML to a file, default `./review.xml`. Keep stdout unused and log to stderr with
  `console.error()` in the main process.
- Bundle assets locally. Outbound network access is limited to the startup update check and
  user-requested remote PR/MR loading through git and `gh`/`glab`. No telemetry or forge posting.
  Serve binds only `127.0.0.1` and enforces Host/Origin checks and a per-process capability on API
  requests. Keep the capability in memory, never persisted.
- Route every host's review writes through `publishReview` in
  `packages/core/src/review-publisher.ts`. Keep serialization pure, stage attachments under unique
  names, and atomically replace XML only after preparation succeeds. Failed publication preserves
  the previous document and assets. Preserve no-follow checks and attachment-origin tracking.
- Preserve output provenance: project/default paths stay physically within the launch directory;
  explicit reviewer paths may be elsewhere. Preserve the project-config restrictions on git
  `--output`, `--ext-diff`, and `--textconv`. Spawn git with an argv array, never a shell string.
- Record loaded diffs through `commitDiffData` with their source identity. Authorize requested paths
  with `authorizeReviewedPath` and read snapshots through `readReviewedContent`. Use
  `rootRelativeReviewedPath` for relative-path mapping. Unknown snapshots fail visibly; do not fall
  back to the working tree or process cwd.
- Only an explicit reviewer Apply action may change reviewed source. Use `applySuggestionForSession`
  and the existing safe writer: reviewed-path membership, valid anchor, exact original-code match,
  safe regular-file destination, and atomic replacement are required. Refuse `.git` paths and unsafe
  links. Temporary remote clones require a reviewer-selected destination outside the clone. Other
  runtime writes are limited to review output, its `.self-review-assets/`, and remote
  materialization's temporary clone or session-owned refs.
- Keep remote fetches in session-owned refs without checkout or working-tree changes. Thread mapping
  runs after diff loading/filtering. Preserve cancellation, timeouts, cleanup on every exit/failure,
  and visible degradation when optional thread sync is unavailable. Cancellation must propagate.
- Route desktop save/quit paths through `QuitController` in `src/main/quit-controller.ts`. Finish
  Review saves and exits only after successful publication. Window close and Quit offer Save & Quit
  / Discard / Cancel. A save failure keeps comments and the window open. The renderer pushes state;
  missing state is an error, never an empty review.
- Keep guides optional, read-only, and separate from review output. Preserve fixed input budgets,
  load diagnostics, manual retry after lazy-load failures, and stale async-result guards.
- Treat reviewed text and diagrams as untrusted. Preserve passive HTML filtering, CSS containment,
  SVG/Mermaid image isolation, strict Mermaid configuration, and rendering size/time limits.

## Review XML and assistant skills

Consult Kenkeep's [review XML index](.ai/kenkeep/nodes/review-xml/index.md) for schema, comment, and
anchor rules, and its [skills index](.ai/kenkeep/nodes/skills/index.md) for review workflows.

- Keep the review schema at `.agents/skills/self-review-apply/assets/self-review-v3.xsd`
  byte-identical to `XSD_SCHEMA` in `packages/core/src/xml-serializer.ts`. Keep the guide schema at
  `.agents/skills/self-review-guide/assets/self-review-guide-v1.xsd` byte-identical to
  `GUIDE_XSD_SCHEMA` in `packages/core/src/guide-schema.ts`. The sync tests are in
  `packages/core/src/xsd-schema.test.ts`.
- Freeze v1/v2 schemas. Read v1/v2/v3 reviews and write v3; v3 changes must remain backward
  compatible. Keep XML text lossless through `xml-text.ts`, with exactly one decoding pass. No
  `<files>` or `<comments>` wrapper elements.
- Validate before publication. Schema violations and XML-illegal characters fail without writing.
  Preserve the existing validator-infrastructure exception: review serialization warns and emits
  unvalidated XML if the validator cannot load; guide loading rejects an unvalidated guide. Core
  library code throws typed errors and never calls `process.exit`.
- Added/context-line comments use only new-line anchors; deleted-line comments use only old-line
  anchors. File-level comments use neither. Validate imported anchors centrally and downgrade
  unusable suggestions to visible file-level feedback with diagnostics.
- Preserve optional author, severity, confidence, and remote provenance fields. Missing severity or
  confidence stays undefined and falls below thresholds. Replies remain flat and ordered; the root
  owns the anchor and classification. The last human turn takes precedence for feedback consumers.
- Read each skill's instructions when invoked: [guide](.agents/skills/self-review-guide/SKILL.md)
  creates orientation, [critique](.agents/skills/self-review-critique/SKILL.md) creates feedback,
  and [apply](.agents/skills/self-review-apply/SKILL.md) consumes it. `.agents/skills/` holds the
  real files; preserve the `.opencode/skills/self-review-*` symlinks.
- Use conventional commit naming for PR titles.
