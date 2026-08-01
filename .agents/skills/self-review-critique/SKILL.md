---
name: self-review-critique
description: Critique a git diff and generate review.xml with comments and suggestions for human validation in self-review
metadata:
  argument-hint: "[git-diff-args...]"
---

# Critique a Git Diff

Analyze a git diff, identify issues, and produce a `review.xml` file that can be loaded into
self-review via `--resume-from` for human validation. The first step generates the walkthrough
guide sidecar via the `self-review-guide` skill, so a critique run yields both artifacts.

## XML Reference

Non-obvious semantics (keep in sync with `../self-review-apply/assets/self-review-v2.xsd`):

- **Line number pairing:** A comment has exactly one pair, `new-line-start`/`new-line-end` (for
  added/context lines) OR `old-line-start`/`old-line-end` (for deleted lines). Never both. If
  neither pair is present, it's a file-level comment.
- **`viewed` attribute:** Set to `true` for all files (the AI "viewed" them all).
- **`path` on renames:** For renamed files (`change-type="renamed"`), `path` is the **new** path.
- **`change-type` values:** `added`, `modified`, `deleted`, `renamed`.
- **`original-code`:** Must be the exact text at the referenced lines, copied verbatim from the
  file content. The applying agent uses text matching to locate the replacement target.
- **`author`:** Set to your model name on every comment you generate (e.g., "Claude Sonnet 4.6").
- **`severity`:** How consequential the finding is **if it is real**: `critical` (data loss,
  security hole, or a crash on a path real usage reaches), `major` (wrong behaviour or a broken
  contract on a path real usage reaches), `minor` (real but bounded; behaviour is correct today),
  `info` (no defect at all: style, naming, a question, a note). Judge impact, not effort.
- **`confidence`:** How sure you are the finding is **real**, not how strongly you worded it:
  `high` (traceable from the diff itself, no assumption about unseen code needed), `medium`
  (rests on one assumption you did not verify, which you must state in the body), `low`
  (speculative: you imagined the failure rather than traced it, or you could not tell intent).

## 1. Generate the Walkthrough Guide

Run the `self-review-guide` skill (`../self-review-guide/SKILL.md`) with the same diff arguments
you received. It analyzes the diff and writes the guide sidecar (`review.guide.xml` by default)
that self-review uses to present the diff as an ordered walkthrough. Then proceed to critique.
A critique run therefore produces both artifacts; the guide skill also runs standalone when a
walkthrough without pre-seeded comments is wanted. If the user explicitly asked to skip the
guide, continue without it — the guide is orientation, never a prerequisite.

## 2. Parse Arguments

Read `$ARGUMENTS` for git diff args. If empty, default to unstaged changes (plain `git diff`).
The arguments support the same format as self-review CLI: `--staged`, `HEAD~3`,
`main..feature-branch`, `-- path/to/file`, etc.

## 3. Load Configuration

Check if `.self-review.yaml` exists in the current directory. If it does, read it to extract:
- **`categories`**: Array of `{name, description, color}` objects, use only these category names
  in your comments
- **`output-file`**: Output path (default `./review.xml`)

If no config file exists, use these default categories:
- `question`, Clarification needed
- `bug`, Likely defect or incorrect behavior
- `security`, Security vulnerability or concern
- `style`, Code style, naming, or formatting issue
- `task`, Action item or follow-up task
- `nit`, Minor nitpick, low priority

## 4. Get the Diff

Use the Bash tool to run:
```bash
git diff $ARGUMENTS
```

If the diff output is empty, report "No changes to review." and stop.

Also capture the repository root for the XML header:
```bash
git rev-parse --show-toplevel
```

## 5. Read File Context

For each file in the diff:
- **Added/Modified files**: Use the Read tool to read the full current file content. This gives
  you context beyond just the changed lines to understand the surrounding code.
- **Deleted files**: Skip reading, the diff contains all the content you need.
- **Binary files**: Skip, note them but don't attempt to review.
- **Renamed files**: Read the file at its new path.

If there are many files (>15), prioritize reading files with the largest diffs first. For very
large files, read only the regions around the changed lines (with 50 lines of surrounding context).

## 6. Critique the Changes

Review each file's changes. Look for:
- **Bugs**: Logic errors, off-by-one errors, null/undefined access, race conditions
- **Security**: Injection vulnerabilities, exposed secrets, missing auth checks, unsafe operations
- **Error handling**: Missing try/catch, unhandled promise rejections, silent failures
- **Types**: Incorrect types, missing type narrowing, unsafe casts
- **Performance**: Unnecessary re-renders, N+1 queries, missing memoization
- **Style**: Unclear naming, inconsistent patterns, dead code

### The evidence bar

Every comment must name the concrete trigger, the line, value, call path, or condition that
makes the problem real in *this* code, on a path that is actually reachable. If the failure
needs a caller, config value, or type you never opened, open it. "This could theoretically fail
if X" where X appears nowhere you read is rejected, not emitted, and a file with no evidenced
problems gets no comments.

| If you find yourself thinking…                 | What it actually signals                       |
| ---------------------------------------------- | ---------------------------------------------- |
| "Defensive coding never hurts."                | No defect found; you invented the requirement. |
| "The caller might pass null."                  | You did not open the caller. Go open it.       |
| "This isn't wrong, but it would be better if…" | Preference, not a defect. `info` at most.      |
| "A future refactor would break this."          | That refactor is not in the diff. Drop it.     |
| "I should flag something in this file."        | Quota-filling. Clean files get no comments.    |
| "It's cheap for the human to dismiss."         | It is not; curator attention is scarce.        |

Evidenced but unconfirmed is a downgrade, not a deletion: keep it at `confidence="low"` under
`question` or `nit`, with the unverified assumption in the body. Unevidenced is a drop,
`confidence="low"` is not a parking spot for speculation.

**Guidelines:**
- Focus on substantive issues. Prioritize bugs and security over style nitpicks.
- Use `suggestion` blocks for every comment where you can propose a concrete fix. The human
  reviewer can then accept or reject each suggestion individually.
- Skip files that look correct, do not force comments on every file.
- Keep comment bodies concise and actionable (1-3 sentences).
- Lead the body with the evidence, the line, value, or path that triggers the problem, then the
  consequence.
- Use file-level comments (no line attributes) for architectural or design concerns that span
  the whole file.

## 7. Build the Review XML

Read the XSD schema at `.agents/skills/self-review-apply/assets/self-review-v2.xsd` for the
complete XML structure and validation rules. The `<xs:documentation>` annotations in the schema
describe all element and attribute semantics.

Construct the XML using the Write tool. Here is a minimal example for reference:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<review xmlns="urn:self-review:v2" timestamp="2026-02-28T14:30:00.000Z" git-diff-args="--staged" repository="/absolute/path/to/repo">
  <file path="src/utils.ts" change-type="modified" viewed="true">
    <comment new-line-start="42" new-line-end="42" author="Claude Sonnet 4.6" severity="major" confidence="high">
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
- `author`: Set to your model name on every comment you generate (e.g., "Claude Sonnet 4.6")
- `severity` and `confidence`: Set both on every comment you generate. They are what lets an
  unattended consumer decide whether to act on a finding, so a comment without them is treated
  as below every threshold and is never applied automatically.
- Calibrating `confidence` honestly is the point of the attribute. Reviewers of this kind
  systematically overstate certainty, wrapping false findings in confident rationales that
  introduce constraints nobody stated. Before writing `high`, check that the failure follows
  from code you actually read. If the argument needs a caller you did not open, a requirement
  you inferred, or a scenario you imagined, it is `medium` or `low`. Lowering confidence is not
  a weaker comment, it is the signal working.
- XML-escape all text content: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`,
  `'` → `&apos;`

## 8. Validate the XML

Use the Bash tool to run:
```bash
xmllint --schema .agents/skills/self-review-apply/assets/self-review-v2.xsd REVIEW_XML_PATH --noout
```

Where `REVIEW_XML_PATH` is the output path from step 3.

- If validation **passes**: proceed to step 9.
- If validation **fails**: read the xmllint errors, fix the XML, and re-validate.
- If `xmllint` is **not installed**: warn the user and continue without validation.

## 9. Output Summary

After writing the file, print a summary:
- Number of files reviewed
- Number of comments generated (by category, and by severity)
- Output file path

Then remind the user how to load the review:
```
To review in self-review:
  self-review <same-diff-args> --resume-from REVIEW_XML_PATH
```
