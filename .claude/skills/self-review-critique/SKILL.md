---
name: self-review-critique
description: Critique a git diff and generate review.xml with comments and suggestions for human validation in self-review
metadata:
  argument-hint: "[git-diff-args...]"
---

# Critique a Git Diff

Analyze a git diff, identify issues, and produce a `review.xml` file that can be loaded into
self-review via `--resume-from` for human validation.

## XML Reference

Non-obvious semantics (keep in sync with `../self-review-apply/assets/self-review-v1.xsd`):

- **Line number pairing:** A comment has exactly one pair — `new-line-start`/`new-line-end` (for
  added/context lines) OR `old-line-start`/`old-line-end` (for deleted lines). Never both. If
  neither pair is present, it's a file-level comment.
- **`viewed` attribute:** Set to `true` for all files (the AI "viewed" them all).
- **`path` on renames:** For renamed files (`change-type="renamed"`), `path` is the **new** path.
- **`change-type` values:** `added`, `modified`, `deleted`, `renamed`.
- **`original-code`:** Must be the exact text at the referenced lines — copied verbatim from the
  file content. The applying agent uses text matching to locate the replacement target.

## 1. Parse Arguments

Read `$ARGUMENTS` for git diff args. If empty, default to unstaged changes (plain `git diff`).
The arguments support the same format as self-review CLI: `--staged`, `HEAD~3`,
`main..feature-branch`, `-- path/to/file`, etc.

## 2. Load Configuration

Check if `.self-review.yaml` exists in the current directory. If it does, read it to extract:
- **`categories`**: Array of `{name, description, color}` objects — use only these category names
  in your comments
- **`output-file`**: Output path (default `./review.xml`)

If no config file exists, use these default categories:
- `question` — Clarification needed
- `bug` — Likely defect or incorrect behavior
- `security` — Security vulnerability or concern
- `style` — Code style, naming, or formatting issue
- `task` — Action item or follow-up task
- `nit` — Minor nitpick, low priority

## 3. Get the Diff

Use the Bash tool to run:
```bash
git diff $ARGUMENTS
```

If the diff output is empty, report "No changes to review." and stop.

Also capture the repository root for the XML header:
```bash
git rev-parse --show-toplevel
```

## 4. Read File Context

For each file in the diff:
- **Added/Modified files**: Use the Read tool to read the full current file content. This gives
  you context beyond just the changed lines to understand the surrounding code.
- **Deleted files**: Skip reading — the diff contains all the content you need.
- **Binary files**: Skip — note them but don't attempt to review.
- **Renamed files**: Read the file at its new path.

If there are many files (>15), prioritize reading files with the largest diffs first. For very
large files, read only the regions around the changed lines (with 50 lines of surrounding context).

## 5. Critique the Changes

Review each file's changes. Look for:
- **Bugs**: Logic errors, off-by-one errors, null/undefined access, race conditions
- **Security**: Injection vulnerabilities, exposed secrets, missing auth checks, unsafe operations
- **Error handling**: Missing try/catch, unhandled promise rejections, silent failures
- **Types**: Incorrect types, missing type narrowing, unsafe casts
- **Performance**: Unnecessary re-renders, N+1 queries, missing memoization
- **Style**: Unclear naming, inconsistent patterns, dead code

**Guidelines:**
- Focus on substantive issues. Prioritize bugs and security over style nitpicks.
- Use `suggestion` blocks for every comment where you can propose a concrete fix. The human
  reviewer can then accept or reject each suggestion individually.
- Skip files that look correct — do not force comments on every file.
- Keep comment bodies concise and actionable (1-3 sentences).
- Use file-level comments (no line attributes) for architectural or design concerns that span
  the whole file.

## 6. Build the Review XML

Read the XSD schema at `.claude/skills/self-review-apply/assets/self-review-v1.xsd` for the
complete XML structure and validation rules. The `<xs:documentation>` annotations in the schema
describe all element and attribute semantics.

Construct the XML using the Write tool. Here is a minimal example for reference:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1" timestamp="2026-02-28T14:30:00.000Z" git-diff-args="--staged" repository="/absolute/path/to/repo">
  <file path="src/utils.ts" change-type="modified" viewed="true">
    <comment new-line-start="42" new-line-end="42">
      <body>Division by zero when input is empty.</body>
      <category>bug</category>
      <suggestion>
        <original-code>  const avg = sum / input.length;</original-code>
        <proposed-code>  if (input.length === 0) return 0;
  const avg = sum / input.length;</proposed-code>
      </suggestion>
    </comment>
  </file>
  <file path="src/other.ts" change-type="added" viewed="true" />
</review>
```

**Additional notes not in the schema:**
- `timestamp`: Get current time with `node -e "console.log(new Date().toISOString())"`
- `repository`: Get absolute path with `git rev-parse --show-toplevel`
- `viewed`: Always `"true"` for all files (the assistant "viewed" them all)
- XML-escape all text content: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`,
  `'` → `&apos;`

## 7. Validate the XML

Use the Bash tool to run:
```bash
xmllint --schema .claude/skills/self-review-apply/assets/self-review-v1.xsd REVIEW_XML_PATH --noout
```

Where `REVIEW_XML_PATH` is the output path from step 2.

- If validation **passes**: proceed to step 8.
- If validation **fails**: read the xmllint errors, fix the XML, and re-validate.
- If `xmllint` is **not installed**: warn the user and continue without validation.

## 8. Output Summary

After writing the file, print a summary:
- Number of files reviewed
- Number of comments generated (by category)
- Output file path

Then remind the user how to load the review:
```
To review in self-review:
  self-review <same-diff-args> --resume-from REVIEW_XML_PATH
```
