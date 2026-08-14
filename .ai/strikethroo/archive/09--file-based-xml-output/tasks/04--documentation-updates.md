---
id: 4
group: 'documentation'
dependencies: [2, 3]
status: 'completed'
created: '2026-02-12'
skills:
  - documentation
---

# Update documentation to reflect file-based output and close confirmation

## Objective

Update all documentation to accurately describe the new file-based XML output, the `output-file` config key, the new close behavior (Finish Review saves, X shows dialog), and the new IPC channels. Remove outdated conventions about stdout and "no confirmation dialogs".

## Skills Required

Documentation writing. Understanding of the codebase architecture for accurate technical descriptions.

## Acceptance Criteria

- [ ] `AGENTS.md`: "stdout is sacred" removed, "No file writes" removed, "Close = done" and "No confirmation dialogs" removed. New conventions added for file output, close behavior, and IPC channels.
- [ ] `docs/PRD.md`: Design Philosophy, Data Flow, CLI examples, stdout/stderr section, Exit Behavior, Security section, Config sections updated. Close confirmation dialog described.
- [ ] `README.md`: Usage examples updated (no `> review.xml` pipe syntax). Design principles updated. `output-file` added to available options list.
- [ ] `src/main/cli.ts`: `printHelp()` examples updated (no `> review.xml` pipe, mention output file config).
- [ ] All documentation is consistent with the actual implementation from Tasks 2 and 3.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

Markdown editing. Familiarity with the project's documentation structure.

## Input Dependencies

- Task 2: Main process file-based save flow (to accurately describe behavior)
- Task 3: Renderer close confirmation dialog (to accurately describe UI behavior)

## Output Artifacts

- Updated `AGENTS.md`
- Updated `docs/PRD.md`
- Updated `README.md`
- Updated `src/main/cli.ts`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### 1. `AGENTS.md`

**Critical Conventions section** — find and update these bullet points:

- **Remove**: `- **stdout is sacred.** Only XML output goes to stdout. All logging, warnings, and errors go to stderr. Use \`console.error()\` for logging in the main process, never \`console.log()\`.`
- **Replace with**: `- **stdout is unused.** Nothing is written to stdout. XML output is written to a file (default \`./review.xml\`, configurable via \`output-file\` in YAML config). All logging goes to stderr. Use \`console.error()\` for logging in the main process, never \`console.log()\`.`

- **Remove**: `- **No file writes.** The app writes nothing to disk. Output goes to stdout only.`
- **Replace with**: `- **One file write.** The app writes exactly one file: the review XML output, at the configured \`output-file\` path (default \`./review.xml\`). No other files are written.`

- **Remove**: `- **Close = done.** Closing the window by any method triggers review:submit → XML serialization → stdout → exit(0). No confirmation dialogs, no save prompts.`
- **Replace with**: `- **Finish Review = save.** Clicking "Finish Review" saves the review to the output file and exits. Closing the window via X/Cmd+Q/Alt+F4 shows a three-way confirmation dialog: Save & Quit / Discard / Cancel.`

**IPC Channels table** — add three new rows:

| `app:close-requested` | Main → Renderer | (none) | Notify renderer that user tried to close the window |
| `app:save-and-quit` | Renderer → Main | (none) | Save review to file and exit |
| `app:discard-and-quit` | Renderer → Main | (none) | Exit without saving |

**What NOT To Do section** — remove: `- Do not add confirmation dialogs on window close.`

### 2. `docs/PRD.md`

This is a large document. Focus on these specific sections:

- **Section 1.3 Design Philosophy**: Change "writes output to stdout" to "writes output to a file". Remove "It behaves like a Unix tool" or update to reflect the new behavior.
- **Data Flow / Architecture section**: Update any mentions of stdout-based output to file-based output.
- **CLI Usage/Examples**: Remove `> review.xml` pipe syntax from examples. Show plain `self-review --staged` instead.
- **Exit Behavior**: Describe the two exit paths (Finish Review button vs X close with dialog).
- **Configuration section**: Add `output-file` to the config options table with description "Path for XML output file" and default `./review.xml`.
- **Security section**: If it mentions "no file writes", update accordingly.

### 3. `README.md`

**"How it works" section** — update the code block:

```bash
# Review staged changes — feedback saved to ./review.xml
self-review --staged

# Feed the feedback back to your AI agent
cat review.xml | claude-code "Apply this review feedback"

# Review changes between branches
self-review main..feature-branch

# Resume a previous review
self-review --staged --resume-from review.xml
```

Remove all `> review.xml` pipe syntax.

**"Design principles" section** — update "CLI-first" to remove "outputs to stdout":

```
- **CLI-first.** Launched from the terminal. Behaves like a Unix tool.
```

Or similar rewording that's accurate.

**"Available options" list** — add:

```
- `output-file`: path for XML output file (default: ./review.xml)
```

### 4. `src/main/cli.ts`

Update the `printHelp()` function. The current examples (lines ~63-68) show `> review.xml` pipe syntax. Replace with:

```
Examples:
  self-review                                     # unstaged changes (git diff default)
  self-review --staged                            # staged changes
  self-review main..feature-branch
  self-review HEAD~3
  self-review -- src/auth.ts
  self-review --resume-from review.xml

Output is written to ./review.xml (configurable via output-file in config).
All arguments except --resume-from and --help are passed to git diff.
If no arguments are provided, shows unstaged working tree changes.
```

</details>
