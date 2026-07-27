---
name: self-review-apply
description: Parse self-review XML feedback and execute the review comments as organized tasks
metadata:
  disable-model-invocation: "true"
  argument-hint: "[review.xml path] [--min-severity=<level>] [--min-confidence=<level>]"
---

# Apply Self-Review Feedback

Read structured review feedback from a self-review XML file and execute the changes.

## XML Reference

Non-obvious semantics (keep in sync with `assets/self-review-v2.xsd`):

- **Line number pairing:** A comment has exactly one pair, `new-line-start`/`new-line-end` (for
  added/context lines) OR `old-line-start`/`old-line-end` (for deleted lines). Never both. If
  neither pair is present, it's a file-level comment.
- **`viewed` attribute:** `true` = reviewer looked at this file. `false` = reviewer did not mark it
  as viewed. Distinguishes "reviewed, no comments" from "not yet reviewed."
- **`path` on renames:** For renamed files (`change-type="renamed"`), `path` is the **new** path.
- **`change-type` values:** `added`, `modified`, `deleted`, `renamed`.
- **`severity`:** How consequential the finding is if it is real, most to least: `critical`,
  `major`, `minor`, `info`. Optional.
- **`confidence`:** How sure the comment's author was that the finding is real, most to least:
  `high`, `medium`, `low`. Optional. Low confidence means the author could not trace the failure
  from the code itself, so the finding may not be real at all.
- **Absent is not neutral.** A comment with no `severity` or no `confidence` is **below every
  threshold**. Never infer a value for it. Comments written by a human in the self-review UI
  normally carry neither, which is why thresholding is opt-in (see step 4).

## 1. Read the Review XML

Read the XML file from `$ARGUMENTS` or default to `./review.xml`. Stop if the file does not exist.

## 2. Validate the XML

Use the Bash tool to run `xmllint --schema assets/self-review-v2.xsd <review-xml-path> --noout`
(where `assets/` is relative to this skill's directory). If validation fails, stop and report the
xmllint errors to the user. If `xmllint` is not installed, warn the user and continue without
validation.

## 3. Load Context

Check the `<review>` root element attributes to determine the review mode and load context:

- **Git mode** (`git-diff-args` and `repository` attributes present): Use the Bash tool to run
  `git diff <git-diff-args>` from the `repository` path. This gives you the same diff the reviewer
  saw. If the diff is too large, limit to files that have comments.
- **Directory mode** (`source-path` attribute present): Read each file listed in the review from the
  `source-path` directory (file `path` attributes are relative to it). Skip deleted files. If a file
  is too large, read only the line ranges referenced by comments (with surrounding context).

This context is essential, without it you're working blind.

## 4. Apply the Threshold (only if asked)

**Default: apply every comment.** A review reaching this skill has normally already been curated
by a human, who kept the comments they wanted acted on. Dropping some of those silently would
discard their work.

Thresholding exists for the unattended case, where nothing has filtered the comments and acting
on a wrong one is worse than acting on nothing. Apply it **only** when `--min-severity` or
`--min-confidence` is present in `$ARGUMENTS`:

- `--min-severity=<level>`, ordered `critical` > `major` > `minor` > `info`.
- `--min-confidence=<level>`, ordered `high` > `medium` > `low`.

A comment passes only if it meets **every** floor that was given. A comment missing the attribute
a floor names always fails that floor, since absent is below every level. Comments that do not
pass are **parked**: do not edit code for them, do not answer them, and do not silently drop
them either. Carry them to the summary.

A caller wanting an unattended run that acts only on findings worth acting on unattended should
pass `--min-severity=major --min-confidence=high`.

## 5. Execute the Feedback

Skip files with zero comments. For files with comments, create one **TaskCreate** task per file,
then spawn subagents to work on independent files concurrently. For small reviews (3 or fewer
files **with comments**), apply changes directly without subagents.

For each file:

1. **Load attachments for this file.** For each comment with `<attachment>` elements, read the
   referenced image file using the Read tool to include it as visual context. The `path` attribute
   contains a relative path from the XML file to the image. If the image file does not exist, note
   this and proceed with text-based feedback only.

2. **Apply suggestions bottom-to-top.** Sort suggestions by line number descending so that
   insertions and deletions don't invalidate line numbers of subsequent suggestions. For each
   `<suggestion>`, find `original-code` in the file and replace it with `proposed-code`. Use line
   numbers as hints but match on text to handle drift.

3. **Address all other comments.** Read the referenced lines, understand the `<body>`, and implement
   the change. Use your judgment. Every comment category is actionable, including `question`, which
   often implies a change is needed. If a question is purely informational (no code change needed),
   answer it in the summary instead.

4. **Complete all changes for one file before moving to the next.**

## 6. Summary

After all feedback has been applied, output a clearly delimited summary section.

### Changes Applied

List each change that was made, grouped by logical unit of work (e.g., "refactored validation logic",
"updated API error handling") rather than by file. Keep entries concise (one line per change).

### Questions & Answers

For every `question` category comment in the review:

- Quote the question.
- Provide your answer.
- State explicitly whether the question resulted in a code change (`Changed` or `No change`).

### Parked Comments

Only when a threshold was applied. For every comment that did not pass, list the file, the line
range, its `severity` and `confidence` (writing `absent` where an attribute was missing), and a
one-line summary of the body. State the floors that were in effect. These were not acted on and
need a human to decide.
