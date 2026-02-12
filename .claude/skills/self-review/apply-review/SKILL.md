---
name: apply-review
description: Parse self-review XML feedback and execute the review comments as organized tasks
disable-model-invocation: true
argument-hint: "[review.xml path]"
---

# Apply Self-Review Feedback

You are a code review execution agent. Your job is to read structured review feedback from a
self-review XML file, understand its schema, organize the feedback into prioritized tasks, and
execute the changes.

## Step 1: Understand the XML Schema

Read the XSD schema bundled with this skill to understand the structure of the review XML:

```
.claude/skills/self-review/apply-review/self-review-v1.xsd
```

Use the XSD annotations and documentation elements to understand:
- What `<review>`, `<file>`, `<comment>`, and `<suggestion>` elements represent
- How line number attributes (`old-line-start`, `new-line-start`, etc.) map to file locations
- The difference between file-level comments (no line attributes) and line-level comments
- How `<suggestion>` elements provide exact code replacements (`original-code` -> `proposed-code`)
- What the `viewed` attribute on `<file>` means
- What the `change-type` attribute values mean

## Step 2: Read the Review XML

Read the review XML file provided by the user:

```
$ARGUMENTS
```

If no argument is provided, default to `./review.xml`.

If the file does not exist, inform the user and stop.

## Step 3: Parse and Categorize Feedback

Extract all `<comment>` elements from the XML and organize them:

### Priority Order (highest to lowest)

1. **security** - Security vulnerabilities (fix immediately)
2. **bug** - Likely defects or incorrect behavior
3. **All other categories** - style, question, nit, or any custom categories

### Grouping Rules

- **Group by file**: Comments on the same file are addressed together
- **Suggestions first**: Within each file, process comments that have `<suggestion>` blocks before
  open-ended comments. Suggestions contain exact `original-code` / `proposed-code` pairs that can
  be applied mechanically
- **Parallel groups**: Changes to different files are independent and can be done in parallel
- **Sequential within a file**: Multiple comments on the same file should be addressed together to
  avoid conflicts

### Skip Rules

- Files with `viewed="true"` and zero comments were reviewed and approved — skip them
- Files with `viewed="false"` and zero comments were not reviewed — skip them (no action needed)
- Comments with category `question` should be listed but not acted on unless the answer is obvious
  from context

## Step 4: Output Task Plan

Before making any changes, output a markdown summary of the planned work:

```
## Review Task Plan

**Source:** [review.xml path]
**Total comments:** [N]
**Files with feedback:** [N]

### Priority: Security
- [ ] `path/to/file.ts` (N comments)
  - Line NN: [brief summary]

### Priority: Bug
- [ ] `path/to/file.ts` (N comments)
  - Line NN: [brief summary]

### Priority: Other
- [ ] `path/to/file.ts` (N comments, N suggestions)
  - Line NN: [brief summary]

### Questions (no action)
- `path/to/file.ts` Line NN: [question text]

### Parallel Execution Groups
- **Group 1:** path/to/a.ts, path/to/b.ts (independent files)
- **Group 2:** path/to/c.ts (depends on Group 1 changes)
```

Omit any priority section that has no comments. Omit the questions section if there are none.

## Step 5: Create Tasks and Execute in Parallel

Use the built-in **TaskCreate** tool to create one task per file that has actionable comments. Each
task should include the file path, the list of comments (with line numbers, categories, and
suggestion bodies), and clear instructions for what to change. Then use **TaskUpdate** to set up
dependencies between tasks that correspond to the parallel execution groups from Step 4.

After creating all tasks, use the **Task** tool to spawn subagents that work on independent files
concurrently. Launch one subagent per parallel execution group — files in the same group can share a
single subagent since they are independent. Files in later groups (that depend on earlier groups)
must wait until those groups complete.

Each subagent (or your own direct execution for small reviews) should follow these rules:

1. **Apply suggestions first.** For each `<suggestion>`, find the `original-code` text in the file
   and replace it with `proposed-code`. Use the line number attributes as hints to locate the code,
   but match on the actual text content to handle line drift.

2. **Address open-ended comments.** For comments without suggestions, read the referenced lines,
   understand the feedback in the `<body>`, and implement the requested change. Use your best
   judgment for how to address the feedback.

3. **Work file by file.** Complete all changes for one file before moving to the next. This avoids
   conflicts from interleaved edits.

4. **Respect the priority order.** Address security and bug comments before style and nit comments.

5. **Skip questions.** Do not make changes for `question` category comments unless the answer is
   obvious and the implied change is clear.

For small reviews (3 or fewer files, all independent), you may skip subagent spawning and apply the
changes directly. For larger reviews, parallelization via the Task tool significantly reduces
execution time.

## Important Notes

- The `repository` attribute on `<review>` tells you the repo root path
- The `git-diff-args` attribute tells you what diff scope was reviewed
- Line numbers in `new-line-start`/`new-line-end` refer to the current (post-change) version of files
- Line numbers in `old-line-start`/`old-line-end` refer to the previous version (for deleted lines)
- File-level comments (no line attributes) apply to the file as a whole
- The `change-type` attribute tells you if a file was added, modified, deleted, or renamed
