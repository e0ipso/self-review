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

- **CLI-first.** The app is launched from the terminal, receives input via CLI arguments, and writes output to stdout. It behaves like a Unix tool.
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
| Build system | Electron Forge or electron-builder | Packaging for macOS and Linux |

### 2.1 Platform Support

- **macOS** (primary development platform)
- **Linux** (x64 and arm64)
- **Windows** is explicitly out of scope

---

## 3. Architecture

### 3.1 Process Model

The application follows Electron's standard two-process model:

- **Main process (Node.js):** Handles CLI argument parsing, runs `git diff`, launches the renderer, manages IPC communication, and writes XML output to stdout on exit.
- **Renderer process (React):** Renders the review UI, manages review state (comments, suggestions), and communicates with the main process via IPC.

### 3.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Terminal                                                            │
│                                                                     │
│  $ self-review --staged > review.xml                                │
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
│                                              stdout (XML)           │
│                                                   │                 │
│                                                   ▼                 │
│                                             review.xml              │
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

---

## 4. CLI Interface

### 4.1 Command Signature

```
self-review [options] [<git-diff-args>...]
```

The CLI accepts any arguments that `git diff` accepts. These are passed through directly to `git diff` as a child process.

### 4.2 Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--resume-from <file>` | string | — | Path to a previously exported XML file. Loads prior comments back into the UI overlaid on the same diff. |
| `--help` | boolean | — | Print usage information and exit. |
| `--version` | boolean | — | Print version and exit. |

### 4.3 Usage Examples

```bash
# Review staged changes
self-review --staged > review.xml

# Review changes between branches
self-review main..feature-branch > review.xml

# Review last 3 commits
self-review HEAD~3 > review.xml

# Review specific files
self-review --staged -- src/auth.ts src/db.ts > review.xml

# Resume a previous review
self-review --staged --resume-from review.xml > review-updated.xml
```

### 4.4 stdout / stderr Separation

- **stdout** is reserved exclusively for XML output. Nothing else may be written to stdout.
- **stderr** is used for all logging, progress messages, warnings, and errors.

This follows standard Unix conventions and enables clean piping with the `>` operator.

### 4.5 Exit Behavior

When the Electron window is closed — by any method (clicking the window close button, pressing Cmd+Q / Ctrl+Q, or any other OS-level close action) — the application:

1. Collects the current review state from the renderer process via IPC.
2. Serializes it to XML.
3. Writes the XML to stdout.
4. Exits with code 0.

There is no distinction between "Done" and "close." Closing the window is "done." There is no confirmation dialog, no summary screen, no separate "submit" action.

If the user closes the window before adding any comments, an empty review XML (valid against the schema, with zero comments) is written to stdout.

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

#### 5.3.3 Syntax Highlighting

All code in the diff viewer is syntax-highlighted using Prism.js. Language detection is based on the file extension. Prism supports a broad set of languages out of the box; no restriction on which languages are supported. The Prism theme follows the application's light/dark theme.

#### 5.3.4 Line Numbers

Both old and new line numbers are displayed. In split view, each side shows its own line numbers. In unified view, both old and new line numbers are shown in separate gutters.

#### 5.3.5 Hunk Headers

Diff hunks (sections starting with `@@`) are rendered with a visual separator showing the hunk header (e.g., `@@ -10,7 +10,8 @@ function authenticate()`).

### 5.4 Commenting System

The commenting system is the core interaction of the application. It closely mirrors GitHub's PR review commenting.

#### 5.4.1 Line Comments

- **Activation:** Clicking on a line number (or a "+" icon that appears on hover) opens a comment input box below that line.
- **Input:** A text area with markdown support (plain text input; no rich text editor needed, but markdown will be preserved in the output).
- **Actions:** "Add comment" button to submit. "Cancel" to discard.
- **Display:** Submitted comments appear inline below the line they reference, with a distinct visual style (e.g., a colored left border, comment author label showing "You").

#### 5.4.2 Multi-Line Comments

- **Activation:** Click and drag across multiple line numbers to select a range, then add a comment that references the entire range.
- **Display:** The selected line range is visually highlighted, and the comment appears below the last line of the range.

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

If custom comment categories are defined in the project-level configuration (see Section 7), each comment can optionally be tagged with a category (e.g., `bug`, `style`, `question`, `nit`, `security`). This appears as a dropdown or chip selector in the comment input UI. Categories are included in the XML output to help AI agents prioritize and categorize feedback.

#### 5.4.6 Editing and Deleting Comments

- Comments can be edited after submission by clicking an "Edit" control.
- Comments can be deleted by clicking a "Delete" control, with no confirmation dialog.

### 5.5 Toolbar

A top toolbar provides global controls:

| Control | Type | Description |
|---------|------|-------------|
| View mode toggle | Segmented button | Switch between Split and Unified diff views |
| Expand/Collapse all | Button | Expand or collapse all file sections at once |
| Theme toggle | Button or dropdown | Switch between Light, Dark, and System theme |

### 5.6 Theming

The application supports three theme modes:

- **Light** — light background, dark text
- **Dark** — dark background, light text
- **System** — follows the operating system's appearance preference (via `prefers-color-scheme`)

The theme affects all UI elements including the Prism syntax highlighting theme. shadcn/ui provides built-in light/dark support. The Prism theme should be swapped to match (e.g., `prism-one-light` / `prism-one-dark` or similar).

The default is **System**.

---

## 6. Output Format

### 6.1 XML with XSD Schema

The review output is an XML document conforming to a published XSD schema. The schema serves two purposes:

1. **Validation:** The application validates its own output against the schema before writing to stdout. If validation fails, the application writes an error to stderr and exits with code 1.
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
- **Categories** are optional and only appear if the project configuration defines them and the reviewer assigns them.
- **No wrapper elements.** `<file>` elements are direct children of `<review>`. No `<files>` or `<summary>` wrappers.

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

# Default output format (reserved for future multi-format support)
output-format: xml
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
5. On close, the updated review state is written to stdout as a new XML file.

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

### 9.4 Large Diffs

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

### 10.3 Error Handling

- If `git` is not installed or not in PATH, the CLI prints a clear error to stderr and exits with code 1.
- If the current directory is not a git repository, same behavior.
- If the `git diff` command fails (e.g., invalid ref), the error message from git is printed to stderr and the app exits with code 1.
- If the `--resume-from` file does not exist or is not valid XML, the app prints an error to stderr and exits with code 1.
- The Electron window must never show a blank white screen due to an uncaught exception. Errors should be caught and displayed inline.

### 10.4 Security

- The application does not open any network connections. All operations are local.
- The application does not execute arbitrary code from the diff content. Syntax highlighting is purely visual.
- The application does not write any files except to stdout. No hidden files, no temp files, no analytics.

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
| **Category** | An optional tag on a comment (e.g., "bug", "nit") used to help AI agents prioritize feedback |
| **Resume** | Loading a prior XML review output back into the UI to continue reviewing |
| **XSD** | XML Schema Definition — a formal description of the structure of the XML output |

---

## 13. Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Should the XSD schema file be written alongside the XML output, or only bundled within the app? | Open |
| 2 | For `--resume-from`, how aggressive should the line-matching heuristic be? Simple line-number-based or context-aware? | Open — start with line-number-based, iterate |
| 3 | Should the app support reviewing diffs from sources other than `git diff` (e.g., piped unified diff from any tool)? | Deferred to v2 |
