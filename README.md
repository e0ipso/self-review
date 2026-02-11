# self-review

A local code review tool for developers working with AI coding agents.

When you use tools like Claude Code to generate code changes, you need to review those changes before accepting them. Today your options are: push to GitHub (exposing unfinished work to a remote server) or squint at diffs in the terminal.

**self-review** gives you GitHub's pull request review UI on your local machine — no remote, no account, no setup. Launch it from the terminal, review the diff, leave comments and suggestions, close the window. Your feedback is written to stdout as structured XML that you pipe directly back to your AI agent.

## How it works

```bash
# Review staged changes, save feedback as XML
self-review --staged > review.xml

# Feed the feedback back to your AI agent
cat review.xml | claude-code "Apply this review feedback"

# Review changes between branches
self-review main..feature-branch > review.xml

# Resume a previous review
self-review --staged --resume-from review.xml > review-updated.xml
```

## What you get

- **GitHub-style diff viewer** — split or unified view, syntax highlighting, collapsible file sections
- **Line comments** — click a line number, type your feedback
- **Multi-line comments** — drag across line numbers to comment on a range
- **Code suggestions** — propose exact replacements, rendered as a diff-within-a-diff
- **Categories** — tag comments as `bug`, `nit`, `security`, `question`, etc.
- **Structured XML output** — validated against an XSD schema, designed for machine consumption
- **Resume support** — pick up where you left off with `--resume-from`

## Configuration

Customize **self-review** with YAML configuration files:

- **User config:** `~/.config/self-review/config.yaml` — personal preferences for all projects
- **Project config:** `.self-review.yaml` — per-project settings (committable)

Project config overrides user config, which overrides built-in defaults.

### Example: Custom comment categories

```yaml
# .self-review.yaml
categories:
  - name: bug
    description: "Likely defect or incorrect behavior"
    color: "#e53e3e"
  - name: security
    description: "Potential security vulnerability"
    color: "#d69e2e"
  - name: nit
    description: "Minor style or formatting suggestion"
    color: "#718096"
  - name: question
    description: "Clarification needed"
    color: "#3182ce"
```

### Available options

- `theme`: light, dark, or system (default: system)
- `diff-view`: split or unified (default: split)
- `font-size`: editor font size in pixels (default: 14)
- `ignore`: file patterns to exclude from diff (glob syntax)
- `categories`: custom comment tags (see example above)
- `default-diff-args`: default arguments passed to `git diff`
- `show-untracked`: show new files not yet added to git (default: true)

See [docs/PRD.md](docs/PRD.md#7-configuration) for complete documentation.

## Design principles

- **CLI-first.** Launched from the terminal, outputs to stdout. Behaves like a Unix tool.
- **One-shot.** Open → review → close → done. No servers, no persistent state.
- **Local-only.** No network access, no accounts, no telemetry. Your code stays on your machine.
- **AI-native output.** The XML format is designed to be parsed by LLMs, with an XSD schema they can reference for structure.

## Requirements

- macOS or Linux
- git
- Node.js 20+
