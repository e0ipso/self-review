# self-review — Product Requirements Document

**Version:** 1.0
**Date:** 2026-02-10
**Author:** Product & Engineering
**Status:** Draft

---

## 1. Overview

**self-review** is a local-only Electron desktop application that provides a GitHub-style pull request review interface for reviewing code diffs without pushing to a remote repository. It is designed for solo developers who use AI coding agents (such as Claude Code) and need a structured way to review AI-generated code changes, leave feedback (comments, suggestions), and export that feedback in a machine-readable format that can be fed back to the AI agent.

### 1.1 Problem Statement

When working with AI coding agents, developers generate code changes that need careful review before acceptance. The current options are:

- **Push to GitHub and review there.** This works but forces the developer to share potentially unfinished, experimental, or private vibe-coded work on a remote server. It also adds unnecessary steps (commit, push, create PR, review, collect comments, feed back to agent).
- **Review diffs in the terminal or editor.** This works for small changes but lacks the structured commenting, suggestion, and navigation capabilities that make GitHub's review UI effective.

**self-review** eliminates these friction points by bringing GitHub's PR review experience to the local machine, with output specifically designed for AI agent consumption.

### 1.2 Target User

A single developer working locally with AI coding agents. They are comfortable with the command line, use git, and want a fast review-feedback loop with their AI agent. They do not need multi-user collaboration, approvals workflows, or CI/CD integration.

### 1.3 Design Philosophy

- **CLI-first.** The app is launched from the terminal, receives input via CLI arguments, and writes output to a file (default `./review.xml`, configurable via `output-file` in YAML config). It behaves like a Unix tool.
- **One-shot workflow.** Open → review → close → done. No persistent state, no servers running in the background.
- **Machine-readable output.** The primary consumer of the review output is an AI agent, not a human. The format must be structured, validated, and self-documenting.
- **Minimal footprint.** No accounts, no cloud, no telemetry, no auto-updates. A local tool that does one thing well.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop shell | Electron | Cross-platform desktop app with CLI integration (same pattern as VS Code) |
| Frontend framework | React | Component-based UI, large ecosystem |
| Language | TypeScript | Type safety across frontend and backend |
| UI components | shadcn/ui | Accessible, composable components built on Radix primitives |
| Syntax highlighting | Prism.js | Broad language coverage, themeable, lightweight |
| Backend | Node.js | Electron's main process, handles CLI, git, IPC, file I/O |
| Markdown rendering | react-markdown + remark-gfm | Rendered markdown view with AST position data for line mapping |
| Diagram rendering | mermaid | Renders Mermaid code blocks as inline SVG diagrams |
| Prose styling | @tailwindcss/typography | Typography classes for rendered markdown content |
| Build system | Electron Forge or electron-builder | Packaging for macOS and Linux |

### 2.1 Platform Support

- **macOS** (primary development platform)
- **Linux** (x64 and arm64)
- **Windows** is explicitly out of scope

---

## 3. Architecture

### 3.1 Process Model

The application follows Electron's standard two-process model:

- **Main process (Node.js):** Handles CLI argument parsing, runs `git diff`, launches the renderer, manages IPC communication, and writes XML output to the configured output file on exit.
- **Renderer process (React):** Renders the review UI, manages review state (comments, suggestions), and communicates with the main process via IPC.

### 3.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Terminal                                                            │
│                                                                     │
│  $ self-review --staged                                             │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────┐     ┌──────────────┐     ┌───────────────────┐    │
│  │ CLI Parser   │────▶│ git diff     │────▶│ Diff Parser       │    │
│  │ (main)       │     │ (child proc) │     │ (unified → AST)   │    │
│  └─────────────┘     └──────────────┘     └───────┬───────────┘    │
│                                                    │                │
│                                              IPC (diff data)        │
│                                                    │                │
│                                                    ▼                │
│                                           ┌────────────────┐       │
│                                           │ Electron Window │       │
│                                           │ (React UI)      │       │
│                                           │                 │       │
│                                           │ • File tree     │       │
│                                           │ • Diff viewer   │       │
│                                           │ • Comments      │       │
│                                           │ • Suggestions   │       │
│                                           └───────┬────────┘       │
│                                                   │                 │
│                                          IPC (review data)          │
│                                                   │                 │
│                                                   ▼                 │
│                                          ┌─────────────────┐       │
│                                          │ XML Serializer   │       │
│                                          │ (main process)   │       │
│                                          └────────┬────────┘       │
│                                                   │                 │
│                                          write to output file        │
│                                                   │                 │
│                                                   ▼                 │
│                                      ./review.xml (default)         │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 IPC Contract

The main process and renderer process communicate via Electron's `ipcMain` / `ipcRenderer` bridge:

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `diff:load` | Main → Renderer | Parsed diff data (files, hunks, lines) | Initial data load |
| `review:submit` | Renderer → Main | Complete review state (all comments, suggestions) | Triggered on window close |
| `resume:load` | Main → Renderer | Previously exported XML parsed back into review state | Resume from prior review |
| `config:load` | Main → Renderer | Merged configuration (user + project) | Theme, view mode, categories |
| `app:close-requested` | Main → Renderer | (none) | Notify renderer that user tried to close the window |
| `app:save-and-quit` | Renderer → Main | (none) | Save review to file and exit |
| `app:discard-and-quit` | Renderer → Main | (none) | Exit without saving |

---

## 4. CLI Interface

### 4.1 Command Signature

```
self-review [options] [<git-diff-args>...]
```

The CLI accepts any arguments that `git diff` accepts. These are passed through directly to `git diff` as a child process. Alternatively, a positional argument can be a path to a non-git directory, in which case the app enters **directory mode** (see Section 4.6).

### 4.2 Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--resume-from <file>` | string | — | Path to a previously exported XML file. Loads prior comments back into the UI overlaid on the same diff. |
| `--help` | boolean | — | Print usage information and exit. |
| `--version` | boolean | — | Print version and exit. |

### 4.3 Usage Examples

```bash
# Review staged changes (writes ./review.xml by default)
self-review --staged

# Review changes between branches
self-review main..feature-branch

# Review last 3 commits
self-review HEAD~3

# Review specific files
self-review --staged -- src/auth.ts src/db.ts

# Resume a previous review
self-review --staged --resume-from review.xml

# Review a non-git directory (all files shown as new additions)
self-review /path/to/generated-code
```

### 4.4 Output and Logging

- **XML output** is written to a file (default `./review.xml`, configurable via `output-file` in YAML config). The output file path is logged to stderr on successful write.
- **stdout** is unused. Nothing is written to stdout.
- **stderr** is used for all logging, progress messages, warnings, and errors.

### 4.5 Exit Behavior

There are two exit paths:

**Finish Review button:** Clicking "Finish Review" in the toolbar saves the review to the configured output file and exits immediately with code 0. This is the primary exit path.

**Window close (X / Cmd+Q / Alt+F4):** Closing the window by any OS-level method shows a three-way confirmation dialog:

1. **Save & Quit** — collects the review state, serializes to XML, writes to the output file, exits with code 0.
2. **Discard** — exits immediately with code 0, without writing any output.
3. **Cancel** — dismisses the dialog and returns to the review.

In both save paths, the application:

1. Collects the current review state from the renderer process via IPC.
2. Serializes it to XML.
3. Writes the XML to the configured output file (default `./review.xml`).
4. Logs the output file path to stderr.
5. Exits with code 0.

If the user saves before adding any comments, an empty review XML (valid against the schema, with zero comments) is written to the output file.

### 4.6 App Launcher Behavior

When launched from macOS Finder, a Linux desktop app launcher, or any other method that does not provide CLI arguments, the application cannot run `git diff` (the working directory is typically the user's home directory, not a git repository). Instead of printing an error and exiting, the app opens a **welcome screen** (see Section 5.7).

**macOS `-psn_XXXX` filtering:** macOS Finder passes a process serial number argument (`-psn_XXXX`) when launching apps by double-clicking. The CLI parser filters these arguments out before processing so they do not interfere with argument parsing or get passed to `git diff`.

**Mode determination logic:** On startup, the app determines which mode to use:

1. If the current working directory is inside a git repository, the app enters **git mode** (normal diff review).
2. If not in a git repo but the first positional argument is an existing directory path, the app enters **directory mode** (all files treated as new additions).
3. Otherwise, the app enters **welcome mode** and displays the welcome screen.

---

## 5. User Interface

The UI is modeled after GitHub's pull request "Files changed" review interface. The following sections describe each UI element in detail.

### 5.1 Layout

The application window consists of two main panels:

- **Left panel — File tree navigator** (collapsible, resizable)
- **Right panel — Diff viewer** (main content area)

The layout is a horizontal split. The file tree takes approximately 20-25% of the window width by default and can be resized by dragging the divider.

### 5.2 File Tree Navigator

A vertical list of all files in the diff, displayed as a flat list with file paths (not a nested directory tree). Each entry shows:

- **File path** relative to the repository root (e.g., `src/auth/login.ts`)
- **Change type badge**: Added (green), Modified (yellow), Deleted (red), Renamed (blue)
- **Additions / deletions count** (e.g., `+42 -17`)
- **Comment count indicator** — shows the number of comments on this file (if any)

**Behaviors:**

- Clicking a file scrolls the diff viewer to that file.
- The currently visible file in the diff viewer is highlighted in the file tree.
- File order matches the order returned by `git diff` (alphabetical by default).

**File search/filter:**

- A search input at the top of the file tree filters files by path substring match.
- Typing `auth` would show only files whose path contains "auth."
- Clearing the search restores the full list.

### 5.3 Diff Viewer

The main content area displays diffs for all files in a single scrollable view (similar to GitHub's "Files changed" tab, not one file at a time).

#### 5.3.0 Empty Diff Help Message

When `git diff` returns no changes (zero files), the diff viewer area displays a help message instead of file sections. This message explains:

1. **Why the diff is empty** — the arguments passed to `self-review` produced no changes.
2. **How arguments work** — all arguments (except `--resume-from`, `--help`, `--version`) are passed directly to `git diff`.
3. **Common examples** — a table of example commands with brief explanations to help the user select the right diff scope.

The examples shown:

| Command | Description |
|---------|-------------|
| `self-review` | Unstaged working tree changes (default) |
| `self-review --staged` | Changes staged for commit |
| `self-review HEAD~1` | Changes in the last commit |
| `self-review main..HEAD` | All changes since branching from main |
| `self-review -- src/` | Limit diff to a specific directory |

If the user provided explicit arguments, the help message includes the actual arguments that were used, so the user can see what was passed to `git diff`.

This empty state replaces the minimal "No files to review" placeholder and serves as inline documentation for first-time users or cases where the user forgot `--staged` or used the wrong ref.

**Directory mode variant:** In directory mode, the empty diff help message does not appear because the directory scanner always produces at least a listing of the scanned directory. All files are shown as additions with change type "added."

#### 5.3.1 File Sections

Each file in the diff is rendered as a collapsible section:

- **Header bar** showing the file path, change type, and additions/deletions count.
- **"Viewed" checkbox** in the header bar. When checked, the file is marked as reviewed. This is recorded in the output XML (`viewed="true"`) to let AI agents distinguish "reviewed with no comments" from "not yet reviewed."
- Clicking the header collapses/expands the file's diff content.
- All files are expanded by default.

#### 5.3.2 Diff View Modes

Two view modes, togglable via a control in the toolbar:

- **Split view (side-by-side):** Old file on the left, new file on the right. Lines are aligned. This is the default.
- **Unified view:** Single column showing both old and new lines interleaved, with `-` and `+` prefixes. Traditional unified diff format.

The selected view mode persists for the session and can be set as a default in configuration.

**Added/deleted file override:** Files with change type `added` or `deleted` always render in unified view, regardless of the selected view mode. In split view, these files would waste half the screen — an added file shows content only on the right pane with the left pane empty, and a deleted file shows content only on the left pane with the right pane empty. Forcing unified view for these files uses the full width for the content that matters.

**Rendered markdown view:** New markdown files (`.md`/`.markdown` with change type `added`) show a per-file "Raw / Rendered" toggle in the file header. When toggled to "Rendered", the file content is displayed as formatted HTML using `react-markdown` with a source-line-mapped gutter. Each rendered block (paragraph, heading, list, code block, table, etc.) is annotated with its source line range from the markdown AST, enabling click-to-comment on rendered content. Mermaid code blocks render as inline SVG diagrams. Comments placed in the rendered view use the same `LineRange` contract as the raw diff view, so switching between views preserves comment placement.

#### 5.3.3 Syntax Highlighting

All code in the diff viewer is syntax-highlighted using Prism.js. Language detection is based on the file extension. Prism supports a broad set of languages out of the box; no restriction on which languages are supported. The Prism theme follows the application's light/dark theme.

#### 5.3.4 Line Numbers

Both old and new line numbers are displayed. In split view, each side shows its own line numbers. In unified view, both old and new line numbers are shown in separate gutters.

#### 5.3.5 Hunk Headers

Diff hunks (sections starting with `@@`) are rendered with a visual separator showing the hunk header (e.g., `@@ -10,7 +10,8 @@ function authenticate()`).

#### 5.3.6 Expand Context

In git mode, expand-context bars appear at hunk boundaries (above the first hunk, between consecutive hunks, and below the last hunk) allowing the reviewer to incrementally load more surrounding context lines. Clicking an expand button re-runs `git diff -U<N>` for the single file via IPC and replaces that file's hunks in the renderer. Expansion is directional: clicking "expand up" only adds lines above the hunk, and "expand down" only adds lines below, tracked per-hunk as `{ above, below }` context budgets. When the gap between hunks is small (20 lines or fewer), a single "Show N hidden lines" button replaces the directional buttons. Bars auto-hide when no more lines remain (determined by reading the file's total line count). This feature is scoped to git mode only and is not shown for untracked or binary files.

### 5.4 Commenting System

The commenting system is the core interaction of the application. It closely mirrors GitHub's PR review commenting.

#### 5.4.1 Line Comments

- **Activation:** Hovering over a code line reveals a "+" icon in the line number gutter. Clicking the icon opens a comment input box below that line. The line number text itself is not interactive.
- **Input:** A text area for writing comments in GitHub-flavored markdown (GFM). The input shows a header indicating the target line (e.g., "Comment on line 13").
- **Actions:** "Comment" button to submit. "Cancel" to discard.
- **Post-save behavior:** After saving, the comment input closes. To add another comment, click the "+" icon again. No automatic new input box appears.
- **Display:** Submitted comments appear inline below the line they reference, with a colored left border, "You" author label, a line range indicator (e.g., "line 13"), optional category badge, and the comment body rendered as GitHub-flavored markdown (bold, italic, code blocks, tables, task lists, strikethrough).

#### 5.4.2 Multi-Line Comments

- **Activation:** Click and drag the "+" gutter icon across multiple lines to select a range. The drag interaction provides real-time visual feedback by highlighting the selected lines with a blue tint.
- **Unified code path:** Single-line and multi-line comments share one interaction model and one state (`commentRange`). Clicking the icon is a degenerate case of dragging (start line equals end line).
- **Hunk boundary constraint:** Drag selection cannot span across hunk boundaries (@@ separators). The selection is clamped to lines within the same hunk.
- **Side constraint (split view):** In split view, drag is locked to the side (old/new) where it started. Cannot drag across sides.
- **Display:** The selected line range is visually highlighted, and the comment appears below the last line of the range with a header indicating the range (e.g., "Comment on lines 6 to 10").

#### 5.4.3 File-Level Comments

- **Activation:** A "Add file comment" button in each file section header.
- **Display:** File-level comments appear at the top of the file's diff section, above the code.

#### 5.4.4 Suggestions (Code Replacement Proposals)

GitHub-style suggestions allow the reviewer to propose literal code replacements:

- **Activation:** Within any comment (line, multi-line, or file-level), the user can insert a suggestion block.
- **Format:** A code block prefixed with `suggestion` (mimicking GitHub's triple-backtick suggestion syntax).
- **Semantics:** The suggestion represents "replace the selected line(s) with this code." The original lines and the proposed replacement are both preserved in the output XML.
- **Display:** Suggestions are rendered as a diff-within-a-diff: the original lines shown as removed (red), the suggestion shown as added (green), within the comment body.

#### 5.4.5 Comment Categories / Tags

Every comment must be assigned a category (e.g., `bug`, `style`, `question`, `nit`, `security`). Categories are defined in the project-level configuration (see Section 7) and the first category is selected by default when creating a new comment. The category selector uses radio-button semantics — exactly one category is always selected and cannot be deselected. Categories are included in the XML output to help AI agents prioritize and categorize feedback.

#### 5.4.6 Editing and Deleting Comments

- Comments can be edited after submission by clicking an "Edit" control.
- Comments can be deleted by clicking a "Delete" control, with no confirmation dialog.

### 5.5 Toolbar

A top toolbar provides global controls:

| Control | Type | Description |
|---------|------|-------------|
| View mode toggle | Segmented button | Switch between Split and Unified diff views |
| Expand/Collapse all | Button | Expand or collapse all file sections at once |
| Show/hide untracked | Toggle button | Show or hide untracked files (new files not yet added to git). Default: on. |
| Line wrap toggle | Toggle button | Wrap or unwrap long lines in the code content area. When off, long lines scroll horizontally. Default: on. |
| Diff stats summary | Text | Shows total files changed, additions (+N in green), and deletions (-N in red). Computed from the parsed diff data. |
| Theme toggle | Button or dropdown | Switch between Light, Dark, and System theme |

### 5.6 Theming

The application supports three theme modes:

- **Light** — light background, dark text
- **Dark** — dark background, light text
- **System** — follows the operating system's appearance preference (via `prefers-color-scheme`)

The theme affects all UI elements including the Prism syntax highlighting theme. shadcn/ui provides built-in light/dark support. The Prism theme should be swapped to match (e.g., `prism-one-light` / `prism-one-dark` or similar).

The default is **System**.

### 5.7 Welcome Screen

The welcome screen is displayed when the app is launched outside a git repository with no directory argument (e.g., from macOS Finder or a Linux app launcher). It provides a centered, single-column layout with:

- **App title and tagline** — "self-review" heading with a short description.
- **Git Mode card** — an informational card explaining that git mode requires launching from the CLI with diff arguments. This card is not interactive; it serves as a hint to use the CLI.
- **Directory Mode card** — an interactive card with:
  - A **Browse...** button that opens a native directory picker dialog.
  - The selected directory path displayed next to the button.
  - A **Start Review** button (appears after selecting a directory) that initiates a directory review, scanning all files recursively and treating them as new additions.

Selecting a directory and clicking "Start Review" transitions the app from the welcome screen to the standard review UI with all files shown as additions.

---

## 6. Output Format

### 6.1 XML with XSD Schema

The review output is an XML document conforming to a published XSD schema. The schema serves two purposes:

1. **Validation:** The application validates its own output against the schema before writing to the output file. If validation fails, the application writes an error to stderr and exits with code 1.
2. **LLM grounding:** The XSD is designed to be fed to an AI agent alongside the review XML, so the agent can understand the structure, semantics, and constraints of the feedback it receives.

### 6.2 XML Structure

The following is the target structure. The exact XSD will be generated as part of implementation, but this defines the conceptual schema.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<review
  xmlns="urn:self-review:v1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:self-review:v1 self-review-v1.xsd"
  timestamp="2026-02-10T14:30:00Z"
  git-diff-args="--staged"
  repository="/path/to/repo"
>
  <!-- In directory mode, git-diff-args and repository are absent; source-path is used instead:
       <review ... source-path="/path/to/directory"> -->

  <file path="src/auth/login.ts" change-type="modified" viewed="true">
    <!-- File-level comment: no line attributes -->
    <comment>
      <body>This file needs a general refactor for error handling consistency.</body>
      <category>style</category>
    </comment>

    <!-- Single-line comment on a new/added line -->
    <comment new-line-start="15" new-line-end="15">
      <body>This variable name is misleading. Consider renaming to `isAuthenticated`.</body>
      <category>nit</category>
    </comment>

    <!-- Comment on a deleted line -->
    <comment old-line-start="23" old-line-end="23">
      <body>Why was this validation removed? It guards against null input.</body>
      <category>bug</category>
    </comment>

    <!-- Multi-line comment with suggestion on new lines -->
    <comment new-line-start="42" new-line-end="48">
      <body>This entire block should be wrapped in a try-catch.</body>
      <category>bug</category>
      <suggestion>
        <original-code>const result = await db.query(sql);
const user = result.rows[0];
if (!user) throw new Error("not found");
return user;</original-code>
        <proposed-code>try {
  const result = await db.query(sql);
  const user = result.rows[0];
  if (!user) throw new Error("not found");
  return user;
} catch (err) {
  logger.error("Query failed", err);
  throw new DatabaseError("User lookup failed", { cause: err });
}</proposed-code>
      </suggestion>
    </comment>
  </file>

  <file path="src/config.ts" change-type="added" viewed="false" />
</review>
```

### 6.3 Schema Design Principles

- **All files from the diff are listed**, even those with no comments, to provide a complete picture.
- **The `viewed` attribute** on each `<file>` records whether the reviewer marked the file as reviewed. This lets an AI agent distinguish "reviewed with no comments" from "not yet reviewed."
- **Comments are unified.** A `<comment>` with no line attributes is a file-level comment. A `<comment>` with line attributes is a line or multi-line comment. There is no separate element for file-level comments.
- **Line comments reference either old or new line numbers.** Comments on added or context lines use `new-line-start` / `new-line-end` (line numbers from the post-change version). Comments on deleted lines use `old-line-start` / `old-line-end` (line numbers from the pre-change version). Exactly one pair should be present for line-level comments; this constraint is enforced by the application (not expressible in XSD 1.0). For single-line comments, start equals end.
- **Suggestions** include both the original code (from the diff) and the proposed replacement, as literal text. The AI agent can apply the suggestion by performing a text replacement.
- **Categories** are required on every comment. The first configured category is selected by default.
- **No wrapper elements.** `<file>` elements are direct children of `<review>`. No `<files>` or `<summary>` wrappers.
- **Source attributes are mode-dependent.** In git mode, the `<review>` element carries `git-diff-args` and `repository` attributes. In directory mode, it carries a `source-path` attribute (the absolute path to the scanned directory) and omits `git-diff-args` and `repository`. All three attributes are optional in the XSD.

### 6.4 XSD Schema File

The XSD schema file (`self-review-v1.xsd`) is bundled with the application and also written alongside the XML output (or referenced by path). The schema is versioned (`v1`) to allow future evolution without breaking existing consumers.

---

## 7. Configuration

### 7.1 Configuration Files

| Scope | Location | Purpose |
|-------|----------|---------|
| User-level | `~/.config/self-review/config.yaml` | Personal preferences that apply across all repos |
| Project-level | `.self-review.yaml` in the repository root | Per-project settings shared with the repo (committable) |

### 7.2 Configuration Precedence

From highest to lowest priority:

1. **CLI flags** (e.g., `--resume-from`)
2. **Project-level config** (`.self-review.yaml`)
3. **User-level config** (`~/.config/self-review/config.yaml`)
4. **Built-in defaults**

Higher-priority values override lower-priority ones on a per-key basis (shallow merge).

### 7.3 User-Level Configuration

```yaml
# ~/.config/self-review/config.yaml

# Theme preference: "light", "dark", or "system"
theme: system

# Default diff view mode: "split" or "unified"
diff-view: split

# Prism syntax highlighting theme (must match available Prism themes)
prism-theme: one-dark

# Editor font size in pixels
font-size: 14

# Output file path for the review XML
output-file: ./review.xml

# Default output format (reserved for future multi-format support)
output-format: xml

# Show untracked files in the diff viewer: true or false
show-untracked: true

# Wrap long lines in the diff viewer: true or false
word-wrap: true
```

### 7.4 Project-Level Configuration

```yaml
# .self-review.yaml (in repo root)

# File patterns to ignore (glob syntax, matched against file paths in the diff)
ignore:
  - "package-lock.json"
  - "yarn.lock"
  - "pnpm-lock.yaml"
  - "*.generated.ts"
  - "*.min.js"
  - "dist/**"

# Custom comment categories/tags available in the UI
categories:
  - name: bug
    description: "Likely defect or incorrect behavior"
    color: "#e53e3e"
  - name: security
    description: "Security vulnerability or concern"
    color: "#dd6b20"
  - name: style
    description: "Code style, naming, or formatting issue"
    color: "#3182ce"
  - name: question
    description: "Clarification needed — not necessarily a problem"
    color: "#805ad5"
  - name: nit
    description: "Minor nitpick, low priority"
    color: "#718096"

# Default git diff arguments for this project
default-diff-args: "--staged"

# Show untracked files (new files not yet added to git): true or false
show-untracked: true

# Wrap long lines in the diff viewer: true or false
word-wrap: true
```

### 7.5 Configuration Validation

Both configuration files are validated on load. Invalid keys are ignored with a warning to stderr. Invalid values (e.g., `theme: purple`) produce a warning and fall back to the default.

The application must not crash due to malformed configuration.

---

## 8. Resume from Prior Review

### 8.1 Mechanism

The `--resume-from` flag accepts a path to a previously exported XML file. The application:

1. Parses the XML file and extracts all comments, suggestions, and categories.
2. Runs `git diff` with the provided arguments to generate the current diff.
3. Launches the Electron window with the diff data and the prior review state overlaid.
4. The user can edit, delete, or add new comments.
5. On save (via "Finish Review" or "Save & Quit"), the updated review state is written to the output file.

### 8.2 Conflict Handling

If the diff has changed since the prior review (e.g., the developer made additional changes), line numbers may no longer match. The application should:

- **Best-effort matching:** Attempt to map prior comments to their original lines using surrounding context (similar to git's rename detection heuristic).
- **Orphaned comments:** Comments that cannot be mapped to any current line are preserved in the output with an `orphaned="true"` attribute and displayed at the top of the relevant file section with a visual indicator.
- **No silent data loss:** Prior comments are never silently dropped.

---

## 9. Git Integration

### 9.1 Git Diff Execution

The CLI runs `git diff` as a child process with the arguments provided by the user. The working directory is the current working directory of the CLI process (i.e., the repo root).

```bash
# Internal execution (simplified)
const diffOutput = execSync(`git diff ${userArgs.join(' ')}`, { cwd: process.cwd() });
```

In addition to tracked changes, the application discovers **untracked files** (new files not yet added to git) via `git ls-files --others --exclude-standard`. For each untracked file, a synthetic unified diff is generated showing all lines as additions. These files are tagged with `isUntracked` internally and can be shown or hidden via a toolbar toggle (default: on) or the `show-untracked` configuration option. Untracked files respect `.gitignore` rules.

### 9.2 Diff Parsing

The raw unified diff output from `git diff` is parsed into a structured AST:

```typescript
interface DiffFile {
  oldPath: string;          // e.g., "a/src/auth.ts"
  newPath: string;          // e.g., "b/src/auth.ts"
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  hunks: DiffHunk[];
}

interface DiffHunk {
  header: string;           // e.g., "@@ -10,7 +10,8 @@ function auth()"
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}
```

### 9.3 Binary Files

Binary files in the diff (e.g., images) are listed in the file tree with a "Binary file" indicator. No diff content is displayed. File-level comments can still be added.

### 9.4 Directory Mode (Non-Git Alternative)

When the app is invoked with a path to a non-git directory (either via the CLI or via the welcome screen's Browse button), it bypasses git entirely and uses a recursive directory scanner. The scanner:

- Reads every file in the directory tree recursively.
- Treats each file as a new addition (`changeType: 'added'`), with all lines shown as additions.
- Generates synthetic `DiffFile[]` entries identical in structure to parsed git diffs, so the renderer handles them uniformly.

This mode is useful for reviewing AI-generated code that exists as standalone files outside a git repository. The XML output uses `source-path` instead of `git-diff-args` and `repository` to identify the reviewed directory.

### 9.5 Large Diffs

No artificial limit is imposed on diff size. Performance for very large diffs (thousands of files, hundreds of thousands of lines) is a concern but not a v1 blocker. The UI should remain responsive through virtualized rendering of the file list and diff content if performance issues arise.

---

## 10. Non-Functional Requirements

### 10.1 Performance

- **Startup time:** The Electron window should be visible within 2 seconds of CLI invocation for diffs under 100 files.
- **Scrolling:** Diff viewer should scroll at 60fps for diffs under 1,000 changed lines.
- **XML serialization:** Output should be written within 500ms of window close.

### 10.2 Accessibility

- Keyboard navigation for the file tree and diff viewer.
- Focus management when opening/closing comment inputs.
- Sufficient color contrast in both light and dark themes.
- Screen reader compatibility is a nice-to-have for v1 but not required.

### Keyboard Navigation

The app supports keyboard-driven code review via Vimium-style hint labels (`f` for line comments, `g` for file jumps) and smooth scrolling (`j`/`k`). All shortcuts are suppressed when text inputs have focus.

### 10.3 Error Handling

- If `git` is not installed or not in PATH, the CLI prints a clear error to stderr and exits with code 1.
- If the current directory is not a git repository and no directory path argument is provided, the app displays the welcome screen instead of exiting with an error. This allows the user to browse for a directory to review or to see instructions for CLI usage.
- If the `git diff` command fails (e.g., invalid ref), the error message from git is printed to stderr and the app exits with code 1.
- If the `--resume-from` file does not exist or is not valid XML, the app prints an error to stderr and exits with code 1.
- The Electron window must never show a blank white screen due to an uncaught exception. Errors should be caught and displayed inline.

### 10.4 Security

- The application does not open any network connections. All operations are local.
- The application does not execute arbitrary code from the diff content. Syntax highlighting is purely visual.
- The application writes the review XML output at the configured `output-file` path (default `./review.xml`). When comments include image attachments, it also creates a `.self-review-assets/` directory alongside the output file containing the referenced image files. No hidden files, no temp files, no analytics.

---

## 11. Out of Scope (v1)

The following are explicitly not part of the v1 release:

- Multi-user collaboration or team features
- Approval/request-changes workflow
- Integration with GitHub, GitLab, or any remote platform
- Markdown or JSON output formats (future, but not v1)
- Windows support
- Auto-update mechanism
- Plugin system
- Comment threading or replies (flat comments only)
- Side-by-side file comparison (comparing two arbitrary files, not a git diff)
- Commit or staging from within the app
- Inline code editing (the app is read-only for code; suggestions are proposed, not applied)

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| **Diff** | The output of `git diff`, showing changes between two states of a repository |
| **Hunk** | A contiguous block of changes within a file diff, delimited by `@@` headers |
| **Line comment** | A review comment attached to a specific line in the diff |
| **Multi-line comment** | A review comment attached to a range of lines in the diff |
| **File-level comment** | A review comment attached to a file as a whole, not to specific lines |
| **Suggestion** | A proposed code replacement within a comment, specifying both the original code and the replacement code |
| **Category** | A required tag on every comment (e.g., "bug", "nit") used to help AI agents prioritize feedback |
| **Resume** | Loading a prior XML review output back into the UI to continue reviewing |
| **XSD** | XML Schema Definition — a formal description of the structure of the XML output |

---

## 13. Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Should the XSD schema file be written alongside the XML output, or only bundled within the app? | Open |
| 2 | For `--resume-from`, how aggressive should the line-matching heuristic be? Simple line-number-based or context-aware? | Open — start with line-number-based, iterate |
| 3 | Should the app support reviewing diffs from sources other than `git diff` (e.g., piped unified diff from any tool)? | Deferred to v2 |
