---
id: 34
summary: "Fix regression where extractFileContent double-strips the first character of rendered markdown lines"
created: 2026-03-09
---

# Plan: Fix Rendered Markdown First-Character Trimming Regression

## Original Work Order

> We recently introduced the fix that trimmed the initial character for some contexts. I think this was meant to remove the plus and minus icons from the div, but this is causing a regression as highlighted in the screenshot. Create a plan to fix the regression.

## Executive Summary

Commit `a80e2b9` ("fix: strip diff prefix from rendered markdown") added `.slice(1)` to
`extractFileContent()` in `RenderedMarkdownView.tsx` to remove a perceived `+`/`-`/` ` diff prefix.
However, the diff parser (`packages/core/src/diff-parser.ts`) already strips this prefix via
`line.substring(1)` when building `DiffLine` objects. The result is a double-strip: the first real
character of every line is removed in the rendered markdown view (e.g., "The" becomes "he",
"Both" becomes "oth").

The fix is to revert the `.slice(1)` call and use `line.content` directly.

## Context

### Current State vs Target State

| Current State | Target State | Why? |
|---|---|---|
| `extractFileContent` calls `.slice(1)` on `line.content` which already has no prefix | `extractFileContent` uses `line.content` as-is | The first character of every rendered markdown line is being truncated |
| Bug exists in both `src/renderer/` and `packages/react/` copies | Both copies are fixed | Both locations were modified in the original commit |

### Background

The original commit `a80e2b9` was based on an incorrect assumption: that `line.content` still
contained the raw diff prefix (`+`, `-`, or ` `). In reality, the canonical diff parser in
`packages/core/src/diff-parser.ts` (lines 140, 149, 158) already calls `line.substring(1)` to
strip the prefix before storing the content. Every consumer of `DiffLine.content` receives
prefix-free text.

The screenshot confirms the regression: headings like "The" render as "he", "This" as "his",
"Both" as "oth" — consistent with the first character being stripped.

## Architectural Approach

```mermaid
flowchart LR
    A[git diff output] -->|"line.substring(1)"| B["DiffLine.content<br/>(prefix stripped)"]
    B -->|"extractFileContent()"| C[Markdown string]
    C --> D[ReactMarkdown renderer]

    style B fill:#ffd,stroke:#aa0
    style C fill:#ffd,stroke:#aa0
```

### Remove the Erroneous `.slice(1)` Call

**Objective**: Restore correct rendered markdown content by removing the double-strip.

The fix is a single-line change in two files:
- `src/renderer/components/DiffViewer/RenderedMarkdownView.tsx` (line 28)
- `packages/react/src/components/DiffViewer/RenderedMarkdownView.tsx` (line 28)

Change `.map(line => line.content.slice(1))` back to `.map(line => line.content)`.

Both files must be updated since commit `a80e2b9` modified both.

## Risk Considerations and Mitigation Strategies

<details>
<summary>Technical Risks</summary>

- **Potential for the original bug to resurface**: The commit message for `a80e2b9` mentions that `+` was being parsed as a markdown list marker. If this was a real issue at the time, it suggests there may have been a code path where `content` still included the prefix.
    - **Mitigation**: The diff parser has used `substring(1)` since its creation. Verify with unit tests that `DiffLine.content` never includes the prefix character. The existing `diff-parser.test.ts` tests confirm this behavior.
</details>

## Success Criteria

### Primary Success Criteria
1. Rendered markdown view displays full text content — no first-character truncation
2. Rendered markdown view does not show `+` prefix characters as list markers
3. Existing unit tests for the diff parser continue to pass

## Documentation

No documentation updates required — this is a bug fix reverting an incorrect change.

## Resource Requirements

### Development Skills
- TypeScript/React familiarity

### Technical Infrastructure
- Existing unit test suite (Vitest)

## Execution Blueprint

**Validation Gates:**
- Reference: `/config/hooks/POST_PHASE.md`

### ✅ Phase 1: Fix Double-Strip Regression
**Parallel Tasks:**
- ✔️ Task 001: Remove erroneous `.slice(1)` from `extractFileContent` in both `RenderedMarkdownView.tsx` copies

### Post-phase Actions

Run unit tests to confirm no regressions:
```bash
npm run test:unit
```

### Execution Summary
- Total Phases: 1
- Total Tasks: 1
- Maximum Parallelism: 1 task (Phase 1)
- Critical Path Length: 1 phase

## Execution Summary

**Status**: ✅ Completed Successfully
**Completed Date**: 2026-03-09

### Results
Removed the erroneous `.slice(1)` call from `extractFileContent` in both `RenderedMarkdownView.tsx` files:
- `src/renderer/components/DiffViewer/RenderedMarkdownView.tsx` (line 28)
- `packages/react/src/components/DiffViewer/RenderedMarkdownView.tsx` (line 28)

All 100 unit tests pass (36 main + 64 renderer). Committed as `b1201c6` ("fix: stop double-stripping markdown line content").

### Noteworthy Events
No significant issues encountered. The fix was a single-line change in two files, exactly as described in the plan.

### Recommendations
No follow-up actions required. The diff parser has always produced prefix-free `line.content` values, so the original `.slice(1)` was never needed.
