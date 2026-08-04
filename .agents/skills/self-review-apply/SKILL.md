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

Non-obvious semantics (keep in sync with `assets/self-review-v3.xsd`):

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
- **A `<comment>` may carry an ordered list of `<reply>` children.** The comment is the root of the
  thread; each reply is a later turn in the conversation about it.
- **Document order is conversation order.** There are no timestamps and no identifiers, the earlier
  reply is the earlier turn, and nothing else sorts them.
- **Replies are flat.** A reply is never nested inside another reply. A reply that answers an
  earlier reply says so in prose.
- **A reply carries `<body>`, an optional `author`, and optional `<attachment>` children.** It
  carries no category, no severity, no confidence and no `<suggestion>`, all four are properties of
  the finding, and the finding is the root comment.
- **Remote provenance:** The `<review>` root may carry `remote-url`, `remote-base-sha`,
  `remote-head-sha`, and `remote-forge` — a third source shape for reviews taken against a
  remote PR/MR (see step 3). `<comment>` and `<reply>` may carry `remote-id`, the forge's
  thread/comment id. `remote-id` is provenance only: never treat it as ordering, and never act
  on it — apply the comment exactly as any other.

## 1. Read the Review XML

Read the XML file from `$ARGUMENTS` or default to `./review.xml`. Stop if the file does not exist.

### Reading a thread

Read a thread top to bottom before acting on it. The root comment states a finding; the replies
argue about it. **The last human turn wins.** A reply with no `author` attribute is the human
reviewer's, and it overrides every earlier machine assertion in that thread, including the root
comment's `severity` and `confidence`. If the human's last reply refutes the finding, do not apply
it, whatever the root comment claims about how consequential or certain it is.

```xml
<review xmlns="urn:self-review:v3" timestamp="2026-02-28T14:30:00.000Z" git-diff-args="--staged" repository="/absolute/path/to/repo">
  <file path="src/parse.ts" change-type="modified" viewed="true">
    <comment new-line-start="42" new-line-end="44" author="Claude Opus 5" severity="major" confidence="medium">
      <body>`parseId` can return undefined here.</body>
      <category>bug</category>
      <reply>
        <body>The caller at line 40 guarantees non-null.</body>
      </reply>
      <reply author="Claude Opus 5">
        <body>Confirmed — withdrawing.</body>
      </reply>
    </comment>
  </file>
</review>
```

Here the last reply is the model's own concession, not a human turn, so it is not the tie-breaker
by the "no `author`" rule, it is simply the model agreeing with the human turn that preceded it.
Either way the outcome is the same: do not apply this finding.

## 2. Validate the XML

Use the Bash tool to run `xmllint --schema assets/self-review-v3.xsd <review-xml-path> --noout`
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
- **Remote mode** (`remote-url` attribute present): Re-materialize the reviewed diff through the
  same clone-aware model self-review uses:
  1. From `remote-url` and `remote-forge`, derive the head ref: `refs/pull/N/head` (github) or
     `refs/merge-requests/N/head` (gitlab).
  2. If the current directory is inside a clone whose remote matches the URL's host and
     owner/repo (`git remote -v`), fetch into it — read-only for the working tree:
     `git fetch <remote> "+<head-ref>:refs/self-review/head"`. Otherwise create a temporary
     blobless clone: `git clone --filter=blob:none https://<host>/<owner>/<repo>.git <tmpdir>`
     followed by `git -C <tmpdir> fetch origin "+<head-ref>:refs/self-review/head"` (git's own
     credentials handle private repos), and remove it when done.
  3. The reviewed diff is pinned by the recorded SHAs — no base-branch lookup is needed:
     `git -C <repo> diff <remote-base-sha>...<remote-head-sha>`. Read file content with
     `git -C <repo> show <remote-head-sha>:<path>` (in a temporary clone the working tree is
     not the PR head).
  4. If the live head (`git -C <repo> rev-parse refs/self-review/head`) differs from
     `remote-head-sha`, the PR/MR has moved since the review: note the drift in your summary
     and treat line anchors as potentially stale (match on text, not just line numbers).

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
