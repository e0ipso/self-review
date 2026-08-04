# self-review

Local-only Electron desktop app that provides a GitHub-style PR review UI for local git diffs and
directory-based reviews (all files treated as new when no repo context is available).
Designed for solo developers reviewing AI-generated code. CLI-first, one-shot workflow: open →
review → close → XML to file. When launched outside a git repo without a directory argument (e.g., from an app launcher), the app shows a welcome screen with a directory picker instead of exiting. It can also review a remote GitHub PR or GitLab MR by URL: the diff is materialized into a local git clone and reviewed with the same machinery (see Remote PR/MR mode).

## Dev Container

Do NOT run e2e tests inside the container, they will not work. Check if you are inside of the dev
container before running the e2e tests.

## Tech Stack

- **Electron** (desktop shell, main + renderer process model)
- **React + TypeScript** (renderer)
- **shadcn/ui** (UI components, built on Radix primitives)
- **Prism.js** (syntax highlighting)
- **react-markdown** + **remark-gfm** (rendered Markdown view with AST positions)
- **mermaid** (Mermaid diagram rendering)
- **@tailwindcss/typography** (prose styling for rendered text content)
- **Node.js** (main process: CLI, git, IPC, file I/O)
- **Electron Forge** (build/packaging)

## Project Structure

```
self-review/
├── CLAUDE.md
├── docs/
│   └── PRD.md                    # Product requirements (source of truth)
├── src/
│   ├── shared/                   # Shared between main and renderer
│   │   ├── types.ts              # All TypeScript interfaces, THE CONTRACT
│   │   └── ipc-channels.ts      # IPC channel name constants
│   ├── main/                     # Electron main process
│   │   ├── main.ts              # App entry point, window creation, exit handler
│   │   ├── cli.ts               # Argument parsing (pass-through to git diff, forge URL & subcommand routing)
│   │   ├── fetch-comments.ts    # Headless `fetch-comments` subcommand orchestrator
│   │   ├── remote-mode.ts       # Remote PR/MR session bootstrap (URL → git-mode inputs)
│   │   ├── git.ts               # Executes git diff as child process
│   │   ├── diff-parser.ts       # Parses unified diff output → DiffFile[]
│   │   ├── ipc-handlers.ts      # ipcMain handlers (diff:load, review:submit, etc.)
│   │   ├── xml-serializer.ts    # ReviewState → XML string (validates against XSD)
│   │   ├── xml-parser.ts        # XML string → ReviewState (for --resume-from)
│   │   ├── version-checker.ts   # Checks GitHub Releases API for updates (startup only)
│   │   ├── payload-sizing.ts    # Compute payload stats & check large-payload thresholds
│   │   └── config.ts            # YAML config loading & merging
│   ├── preload/
│   │   └── preload.ts           # contextBridge exposing IPC to renderer
│   └── renderer/
│       ├── index.tsx             # React entry point
│       ├── App.tsx               # Root component, layout shell
│       ├── context/
│       │   ├── ReviewContext.tsx  # Review state (comments, suggestions)
│       │   └── ConfigContext.tsx  # Merged config (theme, categories, etc.)
│       ├── hooks/
│       │   ├── useReviewState.ts # Comment CRUD, state management
│       │   ├── useDiffNavigation.ts # File tree ↔ diff viewer scroll sync
│       │   └── useEmojiAutocomplete.ts # Emoji shortcode autocomplete in comment editor
│       └── components/
│           ├── Layout.tsx        # Two-panel layout (file tree + diff viewer)
│           ├── FileTree.tsx      # Left panel: file list, search, viewed checkboxes, output path footer
│           ├── Toolbar.tsx       # Top bar: view mode, expand/collapse, theme
│           ├── FileTreeEntry.tsx # Per-file row: badge, path, stats, viewed toggle
│           ├── DiffViewer/
│           │   ├── DiffViewer.tsx     # Orchestrator: renders file sections
│           │   ├── EmptyDiffMessage.tsx # Empty-state messaging by diff source type
│           │   ├── FileSection.tsx    # Orchestrator: hooks + layout composition
│           │   ├── FileSectionHeader.tsx # Sticky header: path, badges, toggles
│           │   ├── FileSectionBody.tsx   # File comments + DiffContentArea
│           │   ├── DiffContentArea.tsx   # Loading/error/binary/view dispatcher
│           │   ├── useDragSelection.ts   # Hook: drag-to-select comment ranges
│           │   ├── useExpandContext.ts   # Hook: expand context lines via git
│           │   ├── InlineCommentSlot.tsx # Shared inline comment row (Split+Unified)
│           │   ├── SplitView.tsx      # Side-by-side diff rendering
│           │   ├── UnifiedView.tsx    # Single-column unified diff rendering
│           │   ├── HunkHeader.tsx     # @@ separator rendering
│           │   ├── ExpandContextBar.tsx # Expand context buttons between hunks
│           │   ├── RenderedMarkdownView.tsx # Rendered Markdown/HTML with source-line-mapped gutter
│           │   ├── RenderedImageView.tsx # Rendered preview for raster images (JPG, PNG, GIF, WebP, ICO, BMP)
│           │   ├── RenderedSvgView.tsx  # Rendered SVG preview via secure img+data-URI
│           │   └── SyntaxLine.tsx     # Single line with Prism highlighting
│           └── Comments/
│               ├── CommentInput.tsx    # Text area + category selector + add/cancel
│               ├── AttachmentDropZone.tsx # Drag-and-drop + paste attachment wrapper
│               ├── SuggestionPanel.tsx    # Original/proposed code textareas
│               ├── AttachmentImage.tsx    # Blob URL lifecycle + image display
│               ├── EmojiAutocomplete.tsx # Inline emoji shortcode dropdown
│               ├── CommentDisplay.tsx  # Rendered comment with edit/delete
│               ├── SuggestionBlock.tsx # Diff-within-diff rendering for suggestions
│               └── CategorySelector.tsx # Dropdown/chip selector for categories
├── packages/
│   ├── core/                    # @self-review/core, headless diff parsing & review logic
│   │                            #   incl. guide-schema.ts (embedded guide XSD) and the guide
│   │                            #   parser/reconciliation for the walkthrough sidecar, plus the
│   │                            #   remote forge machinery: forge-provider.ts (ForgeProvider
│   │                            #   interface + parseForgeUrl), github-provider.ts (gh),
│   │                            #   gitlab-provider.ts (glab), materializer.ts (clone-aware
│   │                            #   diff materialization), thread-mapper.ts (forge threads →
│   │                            #   ReviewComments)
│   ├── react/                   # @self-review/react, React components for review UI
│   │                            #   incl. guided-mode presentation (grouped tree, overview)
│   └── types/                   # @self-review/types, shared TypeScript interfaces (zero runtime deps)
│                                #   incl. ReviewGuide/GuideGroup/ResolvedGuideGroup guide types
```

The project uses **npm workspaces** to manage reusable packages under `packages/*`. The workspace packages `@self-review/core`, `@self-review/react`, and `@self-review/types` expose shared logic, UI components, and shared TypeScript interfaces respectively. The Electron app imports these packages via relative path imports to their source (not through workspace symlinks), so no build step is needed for the packages during development. The Electron app's `src/shared/types.ts` re-exports from `packages/types/src/index` as the canonical type source.

## Keyboard Shortcuts

The app supports Vimium-style keyboard navigation:

- `Ctrl/Cmd+F`, Open find-in-page search bar (Chromium native text search)
- `f`, Activate hint labels on changed diff lines to open a comment input
- `g`, Activate hint labels on file tree entries to jump to a file
- `j` / `k`, Smooth scroll the diff pane down/up
- `Escape`, Dismiss active hint overlay or close find bar

All shortcuts are suppressed when a text input has focus. The implementation lives in `useKeyboardNavigation` hook with `HintOverlay` for rendering hint badges.

## Architecture

Two-process model:

1. **Main process**, parses CLI args, runs `git diff`, parses the unified diff into a structured
   AST (`DiffFile[]`), sends it to the renderer via IPC. On "Finish Review" or "Save & Quit",
   collects review state from renderer via IPC, serializes to XML, writes to the output file, exits.
2. **Renderer process**, React app that renders the review UI. Manages all review state (comments,
   suggestions, viewed flags) in React context. Communicates with main via the preload bridge.

The preload script uses `contextBridge.exposeInMainWorld` to expose a typed `electronAPI` object.
The renderer NEVER imports from `electron` directly.

**Large-payload mode:** When the diff exceeds configurable thresholds (`max-files` or
`max-total-lines`), the main process sends file metadata without hunks in the initial `diff:load`
payload. The renderer lazily requests each file's hunks via the `diff:load-file` IPC channel as
the user navigates, avoiding memory pressure from loading the entire diff at once.

**Guided walkthrough mode:** At startup, the main process looks for an LLM-generated guide
sidecar next to the resolved output path: `<output-basename>.guide.xml` (default `review.xml` →
`review.guide.xml`), overridable via the `guide-file` YAML config key. No CLI flag is involved.
Discovery is one-shot at startup; changing the output path at runtime does not re-discover.
The guide (schema `self-review-guide-v1.xsd`, namespace `urn:self-review-guide:v1`) is parsed
and XSD-validated in `@self-review/core`, then sent to the renderer over the `guide:load` IPC
channel. When present and valid, the file tree reorganizes into the guide's named, ordered
groups (each with a rationale), files show one-line descriptions, and a review-level overview
(Markdown, optional Mermaid) renders before the first file. A Guided/Flat toolbar toggle (shown
only when a guide is loaded) restores the exact alphabetical tree. Loading is tolerant, never
fatal: guide entries whose paths are not in the diff are dropped; diff files the guide never
mentions land in an implicit trailing "Everything else" group; a missing, unparseable, or
schema-invalid guide produces a single stderr warning and the app behaves exactly as without
one. The guide is read-only orientation — it never hides content, never blocks the review, and
never affects the `review.xml` output. It is authored ahead of time by the `self-review-guide`
skill (see Assistant Skills).

**Remote PR/MR mode:** The app accepts a GitHub PR URL (`…/pull/N`) or a GitLab MR URL
(`…/-/merge_requests/N`) as its first positional argument, or through a URL field on the
welcome/splash screen (the `remote:open-url` IPC channel). Forge detection is by URL path shape
only (`parseForgeUrl` in `packages/core/src/forge-provider.ts`), so self-hosted GitLab hosts
work with zero configuration. The diff is always **materialized through local git**
(`packages/core/src/materializer.ts`): if CWD is inside a clone whose remote matches the URL,
the base branch and PR/MR head ref (`refs/pull/N/head` / `refs/merge-requests/N/head`) are
fetched into namespaced local refs (`refs/self-review/*` — no checkout, no working-tree
changes); otherwise a temporary blobless clone (`--filter=blob:none`, never shallow) is created
under the OS temp directory and removed on exit. After materialization, remote mode *is* git
mode: the existing pipeline runs against the clone path and the `baseSha...headSha` range
(`src/main/remote-mode.ts`). Git's own credential machinery handles all clone/fetch transport.
The **conversation plane** (base-branch lookup, discussion-thread fetch) lives behind the
`ForgeProvider` interface in `packages/core/src/forge-provider.ts`, implemented by
`github-provider.ts` (`gh` CLI) and `gitlab-provider.ts` (`glab` CLI; unresolved threads only by
default). When the forge CLI is absent or unauthenticated, the review itself proceeds untouched
(base branch falls back to `git ls-remote --symref` via `resolveRemoteDefaultBranch`) and thread
sync reports as unavailable on stderr. Fetched threads are mapped deterministically to
`ReviewComment` threads by `packages/core/src/thread-mapper.ts` (pure code, no LLM); threads
with no file association land on the sentinel path `''` (`REVIEW_LEVEL_FILE_PATH`). On resume,
the recorded `remote-head-sha` is compared with the live head fetched during materialization and
the renderer shows a non-blocking drift warning when the PR/MR has moved. Nothing is ever sent
to the forge. The headless `self-review fetch-comments <URL> [--all-threads]` subcommand
(`src/main/fetch-comments.ts`) runs the same flow without a window and writes a v3 `review.xml`
with remote provenance and per-thread `remote-id`s.

**Rendered previews:** Newly added files (`changeType === 'added'`) of certain types support a
Raw/Rendered toggle in the file header:
- **Markdown** (`.md`, `.markdown`): rendered via `react-markdown` with line-mapped comment gutter;
  files with YAML front matter (`---` delimited) display the metadata as a styled key-value table
  above the prose content, with arrays as `<ul>` lists and objects as nested tables
- **HTML** (`.html`, `.htm`): rendered directly through the shared rendered-text path used by
  Markdown, with a source-line-mapped gutter for line-range comments against new-file lines;
  raw diff mode remains available, and modified/deleted HTML files are not rendered
- **Raster images** (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.ico`, `.bmp`): loaded as base64
  data URIs via the `diff:load-image` IPC channel and displayed in a constrained `<img>` tag;
  defaults to Rendered view; files over 10 MB show an error message
- **SVG** (`.svg`): content extracted from addition lines and rendered via `<img>` with a
  `data:image/svg+xml;base64,...` URI (blocks script execution); defaults to Raw view

File-level comments are available on all preview types. Line-level comments are available in the
Raw diff view, and through the source-line-mapped gutter for Markdown and HTML rendered text views.
Image and SVG rendered previews support file-level comments only. Detection utilities
(`getRenderedTextMode`, `isPreviewableImage`, `isPreviewableSvg`, `getLanguageFromPath`) are
intentionally duplicated in both `@self-review/core`
(`packages/core/src/file-type-utils.ts`) and `@self-review/react`
(`packages/react/src/utils/file-type-utils.ts`). See the package AGENTS.md files for rationale.

## IPC Channels

Defined in `src/shared/ipc-channels.ts`. Both main and renderer import from here.

| Channel         | Direction       | Payload           | Purpose                               |
| --------------- | --------------- | ----------------- | ------------------------------------- |
| `diff:load`     | Main → Renderer | `DiffLoadPayload` | Send parsed diff on startup           |
| `review:submit` | Renderer → Main | `ReviewState`     | Collect review on window close        |
| `resume:load`   | Main → Renderer | `ResumeLoadPayload` | Load prior comments and viewed files for --resume-from |
| `config:load`   | Main → Renderer | `AppConfig`       | Send merged configuration             |
| `app:close-requested` | Main → Renderer | (none)      | Notify renderer that user tried to close the window |
| `app:save-and-quit`   | Renderer → Main | (none)      | Save review to file and exit          |
| `app:discard-and-quit` | Renderer → Main | (none)     | Exit without saving                   |
| `diff:expand-context`  | Renderer → Main | `ExpandContextRequest` | Re-run git diff with more context for a single file |
| `output-path:change`   | Renderer → Main | `OutputPathInfo \| null` | Open native save dialog to change output path |
| `output-path:changed`  | Main → Renderer | `OutputPathInfo`  | Notify renderer when output path changes       |
| `version-update:available` | Main → Renderer | `VersionUpdateInfo` | Notify renderer of available update        |
| `diff:load-file`               | Renderer → Main | `string` (filePath)  | Load single file's hunks on demand (large mode) |
| `diff:load-image`              | Renderer → Main | `{ filePath }` / `ImageLoadResult` | Load a binary image as base64 data URI for rendered preview |
| `guide:load`               | Main → Renderer | `GuideLoadPayload`  | Send reconciled walkthrough guide when a valid sidecar is discovered |
| `open-external`            | Renderer → Main | `string` (URL)      | Open URL in default browser                |
| `remote:open-url`          | Renderer → Main (invoke) | `string` (URL) / `RemoteOpenUrlResult` | Open a forge PR/MR URL entered on the welcome screen |

Remote payload fields: `DiffLoadPayload.remote` (`RemoteSessionInfo`: URL, base/head SHAs,
forge, thread-sync availability) is present only in a remote PR/MR session.
`ResumeLoadPayload.remoteDrift` (`RemoteDriftInfo`: recorded vs live head SHA, `drifted` flag)
is present only when a resumed document recorded a `remote-head-sha` in a remote session; the
renderer shows a non-blocking warning when `drifted` is true.

## Shared Types

`src/shared/types.ts` is the single source of truth for all data structures. Every file in both main
and renderer imports types from here. **Never duplicate type definitions.**

Key types: `DiffFile`, `DiffHunk`, `DiffLine`, `ReviewComment`, `CommentSeverity`,
`CommentConfidence`, `Suggestion`, `ReviewState`, `AppConfig`, `CategoryDef`, `PayloadStats`,
`RemoteForge`, `RemoteSessionInfo`, `RemoteDriftInfo`.

See the file itself for full definitions.

## Testing

The app has two testing layers:

1. **Unit tests** (Vitest), Fast, isolated tests for business logic and state management
2. **E2E tests** (Playwright + Cucumber), Slow, comprehensive tests for user workflows

### Unit Tests

Unit tests use Vitest with separate configurations for main and renderer processes:

- **Main process tests** (`src/main/**/*.test.ts`): Test Node.js modules (diff parsing, XML
  serialization, git operations). Run in Node.js environment.
- **Renderer tests** (`src/renderer/**/*.test.{ts,tsx}`): Test React hooks and utilities. Run in
  jsdom environment.

**Test file location**: Colocate test files with source files (e.g., `diff-parser.test.ts` next to
`diff-parser.ts`).

**Running tests**:

```bash
npm run test:unit              # Run all unit tests in watch mode
npm run test:unit          # Run all unit tests once
npm run test:unit:main         # Run only main process tests
npm run test:unit:renderer     # Run only renderer tests
npm run test:coverage          # Run tests with coverage report
```

**Dev Container**: Unit tests work in both the dev container and host machine (unlike e2e tests).

**Coverage target**: ~50-60% coverage on business logic. Coverage is collected but thresholds are
not enforced.

### E2E Tests

E2E tests use Playwright with Cucumber BDD in a two-tier approach:

1. **Webapp e2e** (primary, runs in CI), Tests the `@self-review/react` components via a Vite
   dev server with fixture data. Fast, no Electron packaging needed.
2. **Electron e2e** (supplementary, local only), Tests Electron-specific behavior (XML output,
   resume, error handling, welcome screen, expand context, find-in-page). Requires packaging + xvfb.

**Cannot run in dev container**, requires host machine with display.

**Running e2e tests**:

```bash
npm run test:e2e                  # Webapp e2e (CI, fast)
npm run test:e2e:headed           # Webapp e2e with visible browser
npm run test:e2e:electron         # Electron e2e (local only, requires packaging + xvfb)
npm run test:e2e:electron:headed  # Electron e2e with visible browser
```

### Testing Conventions

- Test pure functions and business logic, not implementation details
- Use descriptive test names: `it('parses file addition with single hunk', ...)`
- Group related tests with `describe` blocks
- Mock external dependencies (filesystem, child processes, network)
- For hooks: test state transitions and data integrity
- For parsers: use fixture strings of real input samples

## Critical Conventions

- **stdout is unused.** Nothing is written to stdout. XML output is written to a file (default
  `./review.xml`, configurable via `output-file` in YAML config). All logging goes to stderr. Use
  `console.error()` for logging in the main process, never `console.log()`.
- **No network access (except version check and remote mode).** The app makes zero network
  requests at runtime, with two exceptions. First, on startup it makes a single non-blocking
  request to the GitHub Releases API (`api.github.com`) to check for updates; this request is
  fire-and-forget, if it fails for any reason (offline, timeout, firewall), it is silently
  ignored. Second, when the user supplies a forge PR/MR URL (remote mode), the network is
  touched only for that URL: git clone/fetch through git's own credential machinery (SSH keys,
  credential helpers, `gh auth setup-git`), and the `gh`/`glab` CLIs for base-branch lookup and
  discussion-thread fetch only. Every remote-mode request is user-triggered; nothing is ever
  sent to the forge. No telemetry, no analytics, no CDN fetches. All assets are bundled.
- **File writes.** The app writes the review XML output file at the configured `output-file` path (default `./review.xml`). The output path can be changed at runtime via the save dialog in the file tree footer. When comments include image attachments, it also creates a `.self-review-assets/` directory alongside the output file containing the referenced images. In remote mode, when no matching local clone exists, it additionally creates a temporary blobless clone in a uniquely named directory under the OS temp root, removed on exit (a leftover from a crash sits in the OS temp area, which the OS reclaims); when reusing an existing clone, it only fetches into namespaced refs (`refs/self-review/*`) — the working tree is never touched. No other files are written.
- **XSD sync.** Each XSD schema exists in two places and both copies must be byte-identical:
  `.agents/skills/self-review-apply/assets/self-review-v3.xsd` pairs with the `XSD_SCHEMA` string
  embedded in `packages/core/src/xml-serializer.ts`, and
  `.agents/skills/self-review-guide/assets/self-review-guide-v1.xsd` pairs with the
  `GUIDE_XSD_SCHEMA` string embedded in `packages/core/src/guide-schema.ts`. The sync tests in
  `packages/core/src/xsd-schema.test.ts` enforce both pairs, so editing one copy alone fails the
  unit suite. `self-review-v1.xsd` and `self-review-v2.xsd` are both frozen for consumers of older
  documents, and must not be edited. The current version (v3) may gain optional attributes
  additively — every previously valid v3 document must remain valid against the amended XSD.
- **Read any version, write v3.** The parser is namespace-blind, so `--resume-from` loads v1, v2
  and v3 documents identically. The serializer always emits `urn:self-review:v3`, so a document
  that round-trips through the app is silently upgraded. This is deliberate: `self-review-v1.xsd`
  and `self-review-v2.xsd` stay frozen on disk so a consumer holding an older document keeps a
  working validator.
- **Remote source shape.** The `<review>` root supports a third, mutually exclusive source shape
  alongside `git-diff-args`/`repository` (git mode) and `source-path` (directory mode): the
  optional `remote-url`, `remote-base-sha`, `remote-head-sha` and `remote-forge` (`github` |
  `gitlab`) attributes, set only for a review taken against a remote PR/MR. The SHAs pin the
  reviewed diff so consumers can re-materialize it and detect drift; `remote-forge` names the id
  space of the `remote-id` attributes so consumers need not re-derive the forge from the URL.
  `<comment>` and `<reply>` carry an optional `remote-id` (the forge's thread/comment id,
  recorded by `fetch-comments` and by app remote mode). `remote-id` is forward machinery for a
  future posting feature: the parser and serializer preserve it through resume/save round-trips,
  the UI ignores it, and nothing consumes it today. Remote identity never rides in `author`,
  which stays a pure display name (absent = human). All of these attributes are omitted when
  unset, so a purely local review's output is byte-identical to before the amendment.
- **Harness skill directories.** `.agents/skills/` holds the real skill files.
  `.opencode/skills/self-review-apply`, `.opencode/skills/self-review-critique`, and
  `.opencode/skills/self-review-guide` are **symlinks**
  into it, because opencode discovers project skills under `.opencode/skills/`. Never replace a
  symlink with a copy: duplicated skills collide by name and opencode resolves the collision
  nondeterministically, so a drifted copy silently wins on some runs. `xsd-schema.test.ts` asserts
  all three entries are still symlinks. Root `opencode.json` additionally declares `.agents/skills` as
  a skill path. `.claude/skills/` is gitignored and purely local.
- **Finish Review = save.** Clicking "Finish Review" saves the review to the output file and exits.
  Closing the window via X/Cmd+Q/Alt+F4 shows a three-way confirmation dialog: Save & Quit /
  Discard / Cancel.
- **XML must validate.** The serializer validates output against the XSD before writing. If
  validation fails, write error to stderr and exit(1).
- **Line numbers: old vs new.** Comments on added/context lines use `newLineStart`/`newLineEnd`.
  Comments on deleted lines use `oldLineStart`/`oldLineEnd`. Exactly one pair, never both.
  File-level comments have neither.
- **shadcn/ui for all UI components.** Do not use raw HTML elements for buttons, inputs, dropdowns,
  dialogs, etc. Use shadcn/ui components.
- **Prism.js for syntax highlighting.** Language detection by file extension. Theme must match the
  app's light/dark theme.
- **MDEditor for comments.** `CommentInput` uses `@uiw/react-md-editor` (write-only mode, no
  preview) for the comment body textarea. Suggestion code textareas remain as plain shadcn
  `<Textarea>` components.
- **Emoji shortcode support.** Typing `:` + 2 characters in the comment editor triggers an inline
  autocomplete dropdown (via `useEmojiAutocomplete` hook + `EmojiAutocomplete` component). Emoji
  data comes from `@emoji-mart/data`. A custom remark plugin (`remark-emoji.ts`) converts
  `:shortcode:` text to Unicode emojis in all rendered markdown views (CommentDisplay and
  RenderedMarkdownView).
- **Author attribution.** Comments from the self-review-critique skill include an `author` attribute
  with the model name. When absent, the UI shows "You" with a person icon (human reviewer).
- **Severity and confidence.** `<comment>` carries two optional attributes that let an unattended
  consumer threshold on findings: `severity` (`critical`, `major`, `minor`, `info`) is how
  consequential the finding is if real, `confidence` (`high`, `medium`, `low`) is how sure the
  author is that it is real. Neither has a schema default. **Absent means below every threshold**,
  never "medium", so the serializer omits them when unset and the parser leaves them undefined,
  including for values outside the enumeration. Human-authored comments normally carry neither;
  the UI displays both as badges but does not author them.
- **Threaded replies.** A `<comment>` may carry an ordered list of `<reply>` children. The root
  comment *is* the thread: it owns the anchor, `category`, `severity` and `confidence`, and its
  replies are turns in a conversation about it. Document order is conversation order — there are no
  reply IDs and no timestamps, and nothing else sorts them. Replies are flat, never nested. A reply
  carries a body, an optional `author` and optional attachments, and deliberately carries no
  category, severity, confidence or `<suggestion>`: a counter-proposal goes in the body as a fenced
  code block. For a consumer, the last human turn (a reply with no `author`) is the tie-breaker over
  any earlier machine assertion in that thread.

## Assistant Skills

### self-review-guide

The `/self-review-guide` skill analyzes a git diff and generates the walkthrough guide sidecar
(`review.guide.xml` by default, honoring `output-file`/`guide-file` config) that self-review
discovers at launch for guided mode. The guide orders files into named groups with rationales,
one-line per-file descriptions, and a review-level overview. It asserts reading order only —
no severity, no findings, no skip judgments; that is critique's job. Besides git diff
arguments, it accepts a PR/MR URL as the diff source, materialized through the same
clone-aware model the app uses so the skill reads surrounding code from a real checkout:

```bash
# Guide for staged changes
/self-review-guide --staged

# Guide for changes between branches
/self-review-guide main..feature-branch

# Guide for a remote PR/MR (materialized through the clone-aware model)
/self-review-guide https://github.com/owner/repo/pull/42

# self-review picks the guide up automatically (no flag)
self-review --staged
```

The skill validates its output against `self-review-guide-v1.xsd` before writing. It runs
standalone, and `self-review-critique` invokes it as its first step.

### self-review-critique

The `/self-review-critique` skill critiques a git diff and generates a `review.xml` file with
line-level comments and code suggestions. Its first step invokes `self-review-guide` with the
same diff arguments, so one run yields both the guide sidecar and the review file. The output
can be loaded into self-review for human validation:

```bash
# Critique staged changes
/self-review-critique --staged

# Critique changes between branches
/self-review-critique main..feature-branch

# Human reviews the critique in self-review
self-review --staged --resume-from review.xml
```

The skill reads categories from `.self-review.yaml` and validates output against the XSD schema.
It is the counterpart to `self-review-apply`: critique generates review feedback, apply consumes it.
It accepts a PR/MR URL too, inherited through its guide-first step: the guide skill materializes
the URL into a local clone and critique reviews the materialized diff.

### self-review-apply

The `/self-review-apply` skill reads a `review.xml` file and applies the feedback (suggestions,
comments) to the codebase. When the document carries `remote-url`, it re-materializes the
reviewed diff through the same clone-aware model (existing matching clone, else temporary
blobless clone). See `.agents/skills/self-review-apply/SKILL.md` for details.

## XSD Schema Location

The review XSD schema lives at `.agents/skills/self-review-apply/assets/self-review-v3.xsd`.
This is the single source of truth for the XML output format. The guide sidecar XSD lives at
`.agents/skills/self-review-guide/assets/self-review-guide-v1.xsd` and is the single source of
truth for the walkthrough guide format. See the **XSD sync** convention above for the embedded
copies that must track them.

## Code Reuse

- **No duplication.** Strongly favor extracting small, reusable functions and modules over writing
  code that does very similar things in multiple places. If two pieces of code perform nearly the
  same operation, abstract the shared logic into a single utility and call it from both sites.
- **Extract before extending.** When adding a new feature that overlaps with existing functionality,
  refactor the existing code into a reusable abstraction first, then build the new feature on top of
  it. Do not copy-paste and modify.
- **Small, focused utilities.** Prefer many small single-purpose functions over large monolithic
  ones. Each utility should do one thing and be independently testable.

## What NOT To Do

- Do not install or use `webpack`, Electron Forge handles bundling.
- Do not use `localStorage` or any browser storage APIs.
- Do not use `require()` in the renderer, use ES module imports.
- Do not use `nodeIntegration: true`, use the preload script.
- Do not create wrapper elements in the XML output (no `<files>`, no `<comments>` wrapper).
- Do not store any state outside of React context in the renderer.
- Do not use `console.log()` in the main process (use `console.error()` for stderr logging).

## When submitting a PR

Make sure the PR title follows the conventional commit naming convention.

## Cursor Cloud specific instructions

When developing in a Cursor Cloud Agent VM, read [`.cursor/cloud-instructions.md`](.cursor/cloud-instructions.md) for environment setup and run caveats (building the workspace packages before the app builds, the headless Electron launch recipe, e2e browser install). Load it on demand — it is not needed for routine local work.

<!-- >>> kenkeep:kk-index >>> -->
You are required to load [.ai/kenkeep/ENTRY.md](.ai/kenkeep/ENTRY.md), the small curated entry catalog for this repo. Enter there and descend using progressive disclosure principles.


<!-- <<< kenkeep:kk-index <<< -->
