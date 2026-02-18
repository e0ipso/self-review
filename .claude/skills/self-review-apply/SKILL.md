---
name: self-review-apply
description: Parse self-review XML feedback and execute the review comments as organized tasks
metadata:
  disable-model-invocation: "true"
  argument-hint: "[review.xml path]"
---

# Apply Self-Review Feedback

Read structured review feedback from a self-review XML file and execute the changes.

## 1. Read the XSD Schema

Read `assets/self-review-v1.xsd` to understand the XML structure. The XSD annotations document
everything: elements, attributes, line number semantics, and suggestion format.

## 2. Read the Review XML

Read the XML file from `$ARGUMENTS` or default to `./review.xml`. Stop if the file does not exist.

## 3. Load Image Attachments

For each comment with `<attachment>` elements, read the referenced image file using the Read tool to
include it as visual context before processing the comment. The `path` attribute contains a relative
path from the XML file to the image. If the image file does not exist, note this in your output and
proceed with the text-based feedback only.

## 4. Execute the Feedback

Skip files with zero comments. For files with comments, create one **TaskCreate** task per file,
then spawn subagents to work on independent files concurrently. For small reviews (3 or fewer
files), apply changes directly without subagents.

For each file:

1. **Apply suggestions mechanically.** For each `<suggestion>`, find `original-code` in the file and
   replace it with `proposed-code`. Use line numbers as hints but match on text to handle drift.

2. **Address all other comments.** Read the referenced lines, understand the `<body>`, and implement
   the change. Use your judgment. Every comment category is actionable — including `question`, which
   often implies a change is needed.

3. **Complete all changes for one file before moving to the next.**

## 5. Summary

After all feedback has been applied, output a clearly delimited summary section.

### Changes Applied

List each change that was made, grouped by logical unit of work (e.g., "refactored validation logic",
"updated API error handling") rather than by file. Keep entries concise (one line per change).

### Questions & Answers

For every `question` category comment in the review:

- Quote the question.
- Provide your answer.
- State explicitly whether the question resulted in a code change (`Changed` or `No change`).
