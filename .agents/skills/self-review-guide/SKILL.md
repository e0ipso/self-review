---
name: self-review-guide
description: Analyze a git diff and generate a walkthrough guide sidecar (review.guide.xml) that orders the files into named reading groups with rationales, one-liners, and an overview for self-review's guided mode
metadata:
  argument-hint: "[git-diff-args...]"
---

# Generate a Review Walkthrough Guide

Analyze a git diff and produce a guide XML sidecar that self-review discovers next to its output
file. The guide reorganizes the file tree from alphabetical order into named, ordered groups with
rationales, gives each file a one-line description of its role in the change, and provides a
review-level overview shown before the first file.

The guide asserts **reading order, never review verdicts**. It carries no severity, no confidence,
no findings, and no comments — that is `self-review-critique`'s job. This skill only answers one
question: *in what order, and with what orientation, should a human read this diff?*

## XML Reference

Non-obvious semantics (keep in sync with `assets/self-review-guide-v1.xsd`):

- **Document order IS reading order.** Groups are presented in the order they appear, and files
  within a group in the order they appear. There are no ordering attributes; to reorder, reorder
  the elements.
- **Presentation only, never suppression.** The vocabulary has no way to hide, collapse, or mark
  a file as skippable, and the consumer shows every file regardless. Files you omit from every
  group are not hidden — self-review shows them in an implicit trailing "Everything else" group.
- **Each diff file appears in at most one group.** Duplicating a path across groups is invalid
  authoring; the first mention would win and the rest would be noise.
- **Stale entries degrade silently.** A `<file>` whose `path` matches nothing in the diff is
  silently dropped by the consumer. Paths are repository-relative, same convention as
  `review.xml`; for renamed files, use the **new** path.
- **`rationale` and `description` are single plain-text sentences.** No Markdown, no line breaks.
- **`overview` is Markdown.** Fenced code blocks are allowed, including a ```` ```mermaid ````
  fence for a diagram of the change.
- **Provenance attributes are optional.** `timestamp`, `git-diff-args`, and `repository` mirror
  the review schema's provenance; they help a consumer sanity-check freshness but never affect
  presentation.

## Hard Rules

These are invariants, not style preferences. A guide that breaks them is wrong even if it
validates:

1. **Account for every file.** Every file in the diff either appears in exactly one group or is
   knowingly left to the implicit "Everything else" group. Never lose track of a file; before
   writing the XML, reconcile your group lists against the full diff file list.
2. **Describe and order, never judge skippable.** You may say a group is mechanical churn and
   place it last; you may never say or imply it need not be read. Words like "skip", "ignore",
   "can be skimmed", "no need to review", "safe to ignore" are forbidden in rationales,
   descriptions, and the overview.
3. **No review verdicts.** No bug claims, no severity language, no "looks correct", no "needs
   attention because it is risky code". The guide orients; critique judges.

## 1. Parse Arguments

Read `$ARGUMENTS` for git diff args. If empty, default to unstaged changes (plain `git diff`).
The arguments support the same format as self-review CLI: `--staged`, `HEAD~3`,
`main..feature-branch`, `-- path/to/file`, etc.

## 2. Load Configuration

Check if `.self-review.yaml` exists in the current directory. If it does, read it to extract:

- **`output-file`**: The review output path (default `./review.xml`)
- **`guide-file`**: Explicit guide output path, if set

Determine the guide output path:

1. If `guide-file` is set, use it.
2. Otherwise derive it from the review output path by stripping the last extension (whatever it
   is) and appending `.guide.xml`: `review.xml` → `review.guide.xml`, `out/my-review.xml` →
   `out/my-review.guide.xml`, `review.out` → `review.guide.xml`. An output filename with no
   extension gets `.guide.xml` appended verbatim.

This pairing is how self-review discovers the guide at launch — it looks for
`<output-basename>.guide.xml` next to its configured output path, with no CLI flag.

## 3. Get the Diff

Use the Bash tool to run:
```bash
git diff $ARGUMENTS
```

If the diff output is empty, report "No changes to guide." and stop.

Also capture the repository root for the XML provenance attributes:
```bash
git rev-parse --show-toplevel
```

## 4. Understand the Change

You need enough context to say what role each file plays, not to judge its correctness:

- Read the diff hunks of every file. For most files this is sufficient.
- When a file's role is unclear from its hunks alone (e.g., a small edit whose purpose depends on
  its callers), use the Read tool on the relevant region of the file.
- Binary files and generated/lockfile churn rarely need reading beyond their paths and stats.

Identify the center of gravity: which file(s) contain the change everything else exists for?
Which files are consequences (call-site updates, type fallout)? Which are verification (tests,
fixtures)? Which are mechanical (lockfiles, generated output, formatting)?

## 5. Group and Order

Build the reading path:

- **Aim for 2–5 groups.** One group means you found no structure; more than five means the
  structure is noise.
- **Lead with the core.** The first group holds the files the reviewer must understand first —
  the "Core change" — with a rationale saying why they anchor everything else.
- **Mechanical churn goes late, labeled honestly.** Lockfiles, generated code, and formatting
  fallout belong in a later group whose rationale says what produced them (e.g., "Lockfile and
  generated types regenerated by the dependency bump") — an honest label, never a dismissal.
- **When unsure, promote.** A file you cannot confidently classify goes in an *earlier* group,
  not a later one. Bias toward attention: the cost of over-promoting a boring file is seconds;
  the cost of demoting a load-bearing one is a missed defect.
- **One-liners describe the file's role in *this change***, not what the file is in general.
  "Adds the retry wrapper the other files call" — not "Utility module for HTTP retries".
- **Overview orients, then stops.** A few sentences: what the change does, where to start
  reading, how the groups relate. Include a ```` ```mermaid ```` diagram only when a picture
  genuinely orients — a dependency direction, a before/after flow — not as decoration. Do not
  restate every file.

## 6. Build the Guide XML

Read the XSD schema at `assets/self-review-guide-v1.xsd` (relative to this skill's directory) for
the complete structure and validation rules. The `<xs:documentation>` annotations describe all
element and attribute semantics.

Construct the XML using the Write tool at the output path from step 2. Minimal example:

````xml
<?xml version="1.0" encoding="UTF-8"?>
<guide xmlns="urn:self-review-guide:v1" timestamp="2026-08-01T14:30:00.000Z" git-diff-args="--staged" repository="/absolute/path/to/repo">
  <overview>Adds retry-with-backoff to the HTTP client. Start with the wrapper in `src/retry.ts`; everything else adopts it.

```mermaid
graph LR
  client[src/client.ts] --> retry[src/retry.ts]
  jobs[src/jobs.ts] --> retry
```</overview>
  <group name="Core change">
    <rationale>The retry wrapper everything else calls; read this first.</rationale>
    <file path="src/retry.ts"><description>Adds the retry wrapper the other files call.</description></file>
    <file path="src/client.ts"><description>Switches the HTTP client onto the wrapper.</description></file>
  </group>
  <group name="Tests">
    <rationale>Coverage for the new wrapper and the migrated call sites.</rationale>
    <file path="src/retry.test.ts"><description>Unit tests for backoff timing and give-up behavior.</description></file>
  </group>
</guide>
````

**Additional notes not in the schema:**
- `timestamp`: Get current time with `node -e "console.log(new Date().toISOString())"`
- `repository`: Get absolute path with `git rev-parse --show-toplevel`
- `git-diff-args`: The same arguments from step 1 (empty string if none)
- XML-escape all text content: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`,
  `'` → `&apos;`

## 7. Validate the XML

Use the Bash tool to run:
```bash
xmllint --schema .agents/skills/self-review-guide/assets/self-review-guide-v1.xsd GUIDE_XML_PATH --noout
```

Where `GUIDE_XML_PATH` is the output path from step 2.

- If validation **passes**: proceed to step 8.
- If validation **fails**: read the xmllint errors, fix the XML, and re-validate. An invalid
  guide is silently ignored by self-review (it degrades to the flat view with only a stderr
  warning), so an unvalidated guide risks being a no-op.
- If `xmllint` is **not installed**: warn the user and continue without validation.

## 8. Output Summary

After writing the file, print a summary:
- Number of files in the diff, and how many were placed in explicit groups vs. left to
  "Everything else"
- The group names in reading order
- Output file path

Then remind the user how the guide is picked up:
```
self-review discovers the guide automatically:
  self-review <same-diff-args>
(the guide is loaded when GUIDE_XML_PATH sits next to the review output path)
```
