# self-review

Local-only Electron desktop app that provides a GitHub-style PR review UI for local git diffs and
directory-based reviews (all files treated as new when no repo context is available).
Designed for solo developers reviewing AI-generated code. CLI-first, one-shot workflow: open →
review → close → XML to file. When launched outside a git repo without a directory argument (e.g., from an app launcher), the app shows a welcome screen with a directory picker instead of exiting.

## Dev Container

Do NOT run e2e tests inside the container, they will not work. Check if you are inside of the dev
container before running the e2e tests.

## Tech Stack

- **Electron** (desktop shell, main + renderer process model)
- **React + TypeScript** (renderer)
- **shadcn/ui** (UI components, built on Radix primitives)
- **Prism.js** (syntax highlighting)
- **react-markdown** + **remark-gfm** (rendered markdown view with AST positions)
- **mermaid** (Mermaid diagram rendering)
- **@tailwindcss/typography** (prose styling for rendered markdown)
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
│   │   ├── types.ts              # All TypeScript interfaces — THE CONTRACT
│   │   └── ipc-channels.ts      # IPC channel name constants
│   ├── main/                     # Electron main process
│   │   ├── main.ts              # App entry point, window creation, exit handler
│   │   ├── cli.ts               # Argument parsing (pass-through to git diff)
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
│           ├── DiffViewer/
│           │   ├── DiffViewer.tsx     # Orchestrator: renders file sections
│           │   ├── FileSection.tsx    # Collapsible file header + diff content
│           │   ├── SplitView.tsx      # Side-by-side diff rendering
│           │   ├── UnifiedView.tsx    # Single-column unified diff rendering
│           │   ├── HunkHeader.tsx     # @@ separator rendering
│           │   ├── ExpandContextBar.tsx # Expand context buttons between hunks
│           │   ├── RenderedMarkdownView.tsx # Rendered markdown with source-line-mapped gutter
│           │   ├── RenderedImageView.tsx # Rendered preview for raster images (JPG, PNG, GIF, WebP, ICO, BMP)
│           │   ├── RenderedSvgView.tsx  # Rendered SVG preview via secure img+data-URI
│           │   └── SyntaxLine.tsx     # Single line with Prism highlighting
│           └── Comments/
│               ├── CommentInput.tsx    # Text area + category selector + add/cancel
│               ├── EmojiAutocomplete.tsx # Inline emoji shortcode dropdown
│               ├── CommentDisplay.tsx  # Rendered comment with edit/delete
│               ├── SuggestionBlock.tsx # Diff-within-diff rendering for suggestions
│               └── CategorySelector.tsx # Dropdown/chip selector for categories
├── packages/
│   ├── core/                    # @self-review/core — headless diff parsing & review logic
│   └── react/                   # @self-review/react — React components for review UI
```

The project uses **npm workspaces** to manage reusable packages under `packages/*`. The workspace packages `@self-review/core` and `@self-review/react` expose shared logic and UI components. The Electron app imports these packages via relative path imports to their source (not through workspace symlinks), so no build step is needed for the packages during development.

## Keyboard Shortcuts

The app supports Vimium-style keyboard navigation:

- `Ctrl/Cmd+F` — Open find-in-page search bar (Chromium native text search)
- `f` — Activate hint labels on changed diff lines to open a comment input
- `g` — Activate hint labels on file tree entries to jump to a file
- `j` / `k` — Smooth scroll the diff pane down/up
- `Escape` — Dismiss active hint overlay or close find bar

All shortcuts are suppressed when a text input has focus. The implementation lives in `useKeyboardNavigation` hook with `HintOverlay` for rendering hint badges.

## Architecture

Two-process model:

1. **Main process** — parses CLI args, runs `git diff`, parses the unified diff into a structured
   AST (`DiffFile[]`), sends it to the renderer via IPC. On "Finish Review" or "Save & Quit",
   collects review state from renderer via IPC, serializes to XML, writes to the output file, exits.
2. **Renderer process** — React app that renders the review UI. Manages all review state (comments,
   suggestions, viewed flags) in React context. Communicates with main via the preload bridge.

The preload script uses `contextBridge.exposeInMainWorld` to expose a typed `electronAPI` object.
The renderer NEVER imports from `electron` directly.

**Large-payload mode:** When the diff exceeds configurable thresholds (`max-files` or
`max-total-lines`), the main process sends file metadata without hunks in the initial `diff:load`
payload. The renderer lazily requests each file's hunks via the `diff:load-file` IPC channel as
the user navigates, avoiding memory pressure from loading the entire diff at once.

**Rendered previews:** Newly added files (`changeType === 'added'`) of certain types support a
Raw/Rendered toggle in the file header, following the same eligibility pattern as Markdown:
- **Markdown** (`.md`, `.markdown`): rendered via `react-markdown` with line-mapped comment gutter
- **Raster images** (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.ico`, `.bmp`): loaded as base64
  data URIs via the `diff:load-image` IPC channel and displayed in a constrained `<img>` tag;
  defaults to Rendered view; files over 10 MB show an error message
- **SVG** (`.svg`): content extracted from addition lines and rendered via `<img>` with a
  `data:image/svg+xml;base64,...` URI (blocks script execution); defaults to Raw view

File-level comments are available on all preview types. Line-level comments are only available
in the Raw diff view. Detection utilities (`isPreviewableImage`, `isPreviewableSvg`) live in
`@self-review/core` (`packages/core/src/file-type-utils.ts`).

## IPC Channels

Defined in `src/shared/ipc-channels.ts`. Both main and renderer import from here.

| Channel         | Direction       | Payload           | Purpose                               |
| --------------- | --------------- | ----------------- | ------------------------------------- |
| `diff:load`     | Main → Renderer | `DiffFile[]`      | Send parsed diff on startup           |
| `review:submit` | Renderer → Main | `ReviewState`     | Collect review on window close        |
| `resume:load`   | Main → Renderer | `ReviewComment[]` | Load prior comments for --resume-from |
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
| `open-external`            | Renderer → Main | `string` (URL)      | Open URL in default browser                |

## Shared Types

`src/shared/types.ts` is the single source of truth for all data structures. Every file in both main
and renderer imports types from here. **Never duplicate type definitions.**

Key types: `DiffFile`, `DiffHunk`, `DiffLine`, `ReviewComment`, `Suggestion`, `ReviewState`,
`AppConfig`, `CategoryDef`, `PayloadStats`.

See the file itself for full definitions.

## Testing

The app has two testing layers:

1. **Unit tests** (Vitest) — Fast, isolated tests for business logic and state management
2. **E2E tests** (Playwright + Cucumber) — Slow, comprehensive tests for user workflows

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

1. **Webapp e2e** (primary, runs in CI) — Tests the `@self-review/react` components via a Vite
   dev server with fixture data. Fast, no Electron packaging needed.
2. **Electron e2e** (supplementary, local only) — Tests Electron-specific behavior (XML output,
   resume, error handling, welcome screen, expand context, find-in-page). Requires packaging + xvfb.

**Cannot run in dev container** — requires host machine with display.

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
- **No network access (except version check).** The app makes zero network requests at runtime,
  with one exception: on startup, it makes a single non-blocking request to the GitHub Releases
  API (`api.github.com`) to check for updates. This request is fire-and-forget — if it fails for
  any reason (offline, timeout, firewall), it is silently ignored. No telemetry, no analytics, no
  CDN fetches. All assets are bundled.
- **File writes.** The app writes the review XML output file at the configured `output-file` path (default `./review.xml`). The output path can be changed at runtime via the save dialog in the file tree footer. When comments include image attachments, it also creates a `.self-review-assets/` directory alongside the output file containing the referenced images. No other files are written.
- **XSD sync.** The XSD schema exists in two locations: `.claude/skills/self-review-apply/assets/self-review-v1.xsd` (standalone) and embedded as a string in `src/main/xml-serializer.ts`. Both copies must be kept in sync when the schema changes.
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

## Assistant Skills

### self-review-critique

The `/self-review-critique` skill critiques a git diff and generates a `review.xml` file with
line-level comments and code suggestions. The output can be loaded into self-review for human
validation:

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

### self-review-apply

The `/self-review-apply` skill reads a `review.xml` file and applies the feedback (suggestions,
comments) to the codebase. See `.claude/skills/self-review-apply/SKILL.md` for details.

## XSD Schema Location

The XSD schema lives at `.claude/skills/self-review-apply/assets/self-review-v1.xsd`. This is
the single source of truth for the XML output format.

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

- Do not install or use `webpack` — Electron Forge handles bundling.
- Do not use `localStorage` or any browser storage APIs.
- Do not use `require()` in the renderer — use ES module imports.
- Do not use `nodeIntegration: true` — use the preload script.
- Do not create wrapper elements in the XML output (no `<files>`, no `<comments>` wrapper).
- Do not store any state outside of React context in the renderer.
- Do not use `console.log()` in the main process (use `console.error()` for stderr logging).

## When submitting a PR

Make sure the PR title follows the conventional commit naming convention.

