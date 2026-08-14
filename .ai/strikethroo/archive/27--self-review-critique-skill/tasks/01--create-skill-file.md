---
id: 1
group: "skill-creation"
dependencies: []
status: "completed"
created: "2026-02-28"
skills:
  - prompt-engineering
---
# Create the self-review-critique SKILL.md

## Objective
Create the skill file at `.claude/skills/self-review-critique/SKILL.md` that instructs an AI assistant to critique a git diff and produce a valid `review.xml` file.

## Skills Required
- prompt-engineering: Writing structured Claude Code skill instructions

## Acceptance Criteria
- [ ] Skill file exists at `.claude/skills/self-review-critique/SKILL.md`
- [ ] YAML frontmatter has correct name, description, metadata, and argument-hint
- [ ] Instructions cover: argument parsing, config loading, diff execution, file reading, critique generation, XML building, validation, and output writing
- [ ] XML generation instructions reference the XSD from `../self-review-apply/assets/self-review-v1.xsd`
- [ ] Line number mapping rules are explicit and correct
- [ ] Category discovery from `.self-review.yaml` is documented with fallback defaults
- [ ] Review quality guidelines direct the AI toward substantive, actionable feedback
- [ ] The skill handles edge cases: no changes, binary files, renamed files, deleted files

## Technical Requirements
- Follow the existing `self-review-apply/SKILL.md` structure and conventions as a reference
- Use `$ARGUMENTS` for git diff args, default to unstaged changes if empty
- The XML must use namespace `urn:self-review:v1`
- Reference the shared XSD at relative path `../self-review-apply/assets/self-review-v1.xsd`
- Output to `./review.xml` by default, or the `output-file` from `.self-review.yaml`

## Input Dependencies
None — first task.

## Output Artifacts
- `.claude/skills/self-review-critique/SKILL.md` — the complete skill file

## Implementation Notes

<details>

The skill file should have this frontmatter:
```yaml
---
name: self-review-critique
description: Critique a git diff and generate review.xml with comments and suggestions for human validation in self-review
metadata:
  argument-hint: "[git-diff-args...]"
---
```

The skill instructions should be organized into these numbered steps:

**1. Parse Arguments**
- Read `$ARGUMENTS` for git diff args
- If empty, default to unstaged changes (no args = `git diff`)
- Support same args as self-review: `--staged`, `HEAD~3`, `main..feature`, `-- path/to/file`

**2. Load Configuration**
- Read `.self-review.yaml` in the current directory if it exists
- Extract `categories` array (each has `name`, `description`, `color`)
- Extract `output-file` if present (default `./review.xml`)
- If no config file, use default categories: question, bug, security, style, task, nit

**3. Get the Diff**
- Run `git diff $ARGUMENTS` using Bash tool
- If diff is empty, report "No changes to review" and stop
- Parse the unified diff output to identify changed files and line numbers

**4. Read File Context**
- For each modified/added file in the diff, read the full current file content using the Read tool
- For deleted files, note them but don't read (content is in the diff)
- This gives the AI surrounding context beyond just the changed lines

**5. Critique the Changes**
- Analyze each file's changes for:
  - Bugs and logic errors
  - Security vulnerabilities
  - Missing error handling for edge cases
  - Style and naming issues
  - Performance concerns
  - Missing or incorrect types
- Prioritize substantive issues over nitpicks
- Use `suggestion` blocks for concrete fixes whenever possible
- Skip files that look correct — don't force comments

**6. Build the Review XML**
Construct XML following this exact structure:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v1" timestamp="YYYY-MM-DDTHH:mm:ss.sssZ" git-diff-args="THE_ARGS" repository="/absolute/path/to/repo">
  <file path="relative/path.ts" change-type="modified" viewed="true">
    <comment new-line-start="42" new-line-end="42">
      <body>Description of the issue in markdown</body>
      <category>bug</category>
      <suggestion>
        <original-code>const x = foo()</original-code>
        <proposed-code>const x = foo() ?? defaultValue</proposed-code>
      </suggestion>
    </comment>
  </file>
  <file path="other/file.ts" change-type="added" viewed="true" />
</review>
```

Critical XML rules to include in the skill:
- `timestamp`: Use current ISO 8601 datetime
- `repository`: Use output of `git rev-parse --show-toplevel`
- `git-diff-args`: The args passed to `git diff`
- `change-type`: Match what git reports — `added`, `modified`, `deleted`, `renamed`
- `viewed="true"` for all files (the AI "viewed" them)
- For comments on added/context lines: use `new-line-start`/`new-line-end`
- For comments on deleted lines: use `old-line-start`/`old-line-end`
- Never use both old and new line attributes on the same comment
- No line attributes = file-level comment
- XML-escape all text: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `'` → `&apos;`
- `<original-code>` must be the exact text at those lines in the diff
- Files with no comments: self-closing `<file ... />`

**7. Validate**
- Run `xmllint --schema ../self-review-apply/assets/self-review-v1.xsd review.xml --noout` if xmllint is available
- If validation fails, fix the XML and retry
- If xmllint is not installed, warn and continue

**8. Write Output**
- Write the XML to the output path (default `./review.xml`)
- Print summary: number of files reviewed, number of comments, output path
- Remind the user they can load it: `self-review <same-args> --resume-from review.xml`

</details>
