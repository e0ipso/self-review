# self-review

Local-only Electron desktop app that provides a GitHub-style PR review UI for local git diffs.
Designed for solo developers reviewing AI-generated code. CLI-first, one-shot workflow: open →
review → close → XML to file.

## Dev Container

Do NOT run e2e tests inside the container, they will not work. Check if you are inside of the dev
container before running the e2e tests.

## Tech Stack

- **Electron** (desktop shell, main + renderer process model)
- **React + TypeScript** (renderer)
- **shadcn/ui** (UI components, built on Radix primitives)
- **Prism.js** (syntax highlighting)
- **Node.js** (main process: CLI, git, IPC, file I/O)
- **Electron Forge** (build/packaging)

## Project Structure

```
self-review/
├── CLAUDE.md
├── docs/
│   ├── PRD.md                    # Product requirements (source of truth)
│   └── self-review-v1.xsd       # XML schema (source of truth for output format)
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
│       │   └── useDiffNavigation.ts # File tree ↔ diff viewer scroll sync
│       └── components/
│           ├── Layout.tsx        # Two-panel layout (file tree + diff viewer)
│           ├── FileTree.tsx      # Left panel: file list, search, viewed checkboxes
│           ├── Toolbar.tsx       # Top bar: view mode, expand/collapse, theme
│           ├── DiffViewer/
│           │   ├── DiffViewer.tsx     # Orchestrator: renders file sections
│           │   ├── FileSection.tsx    # Collapsible file header + diff content
│           │   ├── SplitView.tsx      # Side-by-side diff rendering
│           │   ├── UnifiedView.tsx    # Single-column unified diff rendering
│           │   ├── HunkHeader.tsx     # @@ separator rendering
│           │   └── SyntaxLine.tsx     # Single line with Prism highlighting
│           └── Comments/
│               ├── CommentInput.tsx    # Text area + category selector + add/cancel
│               ├── CommentDisplay.tsx  # Rendered comment with edit/delete
│               ├── SuggestionBlock.tsx # Diff-within-diff rendering for suggestions
│               └── CategorySelector.tsx # Dropdown/chip selector for categories
```

## Architecture

Two-process model:

1. **Main process** — parses CLI args, runs `git diff`, parses the unified diff into a structured
   AST (`DiffFile[]`), sends it to the renderer via IPC. On "Finish Review" or "Save & Quit",
   collects review state from renderer via IPC, serializes to XML, writes to the output file, exits.
2. **Renderer process** — React app that renders the review UI. Manages all review state (comments,
   suggestions, viewed flags) in React context. Communicates with main via the preload bridge.

The preload script uses `contextBridge.exposeInMainWorld` to expose a typed `electronAPI` object.
The renderer NEVER imports from `electron` directly.

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

## Shared Types

`src/shared/types.ts` is the single source of truth for all data structures. Every file in both main
and renderer imports types from here. **Never duplicate type definitions.**

Key types: `DiffFile`, `DiffHunk`, `DiffLine`, `ReviewComment`, `Suggestion`, `ReviewState`,
`AppConfig`, `CategoryDef`.

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

E2E tests use Playwright with Cucumber BDD:

- **Cannot run in dev container** — requires host machine with display
- Test complete user workflows from CLI invocation to XML output
- Run with `npm run test:e2e` (headless) or `npm run test:e2e:headed`

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
- **No network access.** The app makes zero network requests. No telemetry, no analytics, no CDN
  fetches. All assets are bundled.
- **One file write.** The app writes exactly one file: the review XML output, at the configured
  `output-file` path (default `./review.xml`). No other files are written.
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

## XSD Schema Sync

The XSD schema `docs/self-review-v1.xsd` is the source of truth. A copy exists at
`.claude/skills/self-review/apply-review/assets/self-review-v1.xsd` for the Claude Code skill. **When
updating the XSD, both copies must be kept in sync.**

## What NOT To Do

- Do not install or use `webpack` — Electron Forge handles bundling.
- Do not use `localStorage` or any browser storage APIs.
- Do not use `require()` in the renderer — use ES module imports.
- Do not use `nodeIntegration: true` — use the preload script.
- Do not create wrapper elements in the XML output (no `<files>`, no `<comments>` wrapper).
- Do not store any state outside of React context in the renderer.
- Do not use `console.log()` in the main process (use `console.error()` for stderr logging).
