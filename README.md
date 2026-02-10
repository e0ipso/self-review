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

## Design principles

- **CLI-first.** Launched from the terminal, outputs to stdout. Behaves like a Unix tool.
- **One-shot.** Open → review → close → done. No servers, no persistent state.
- **Local-only.** No network access, no accounts, no telemetry. Your code stays on your machine.
- **AI-native output.** The XML format is designed to be parsed by LLMs, with an XSD schema they can reference for structure.

## Requirements

- macOS or Linux
- git
- Node.js 20+
