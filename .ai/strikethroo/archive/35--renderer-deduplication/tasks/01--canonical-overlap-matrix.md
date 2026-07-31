---
id: 1
group: "preparation"
dependencies: []
status: "pending"
created: "2026-03-11"
skills:
  - "typescript"
---
# Generate Canonical Overlap Matrix

## Objective
Produce an authoritative classification matrix of every file that exists in both `src/renderer/` and `packages/react/src/`, categorized as `identical`, `import-only`, or `behavioral`. This matrix is the scope authority for all deduplication work.

## Skills Required
- TypeScript (reading and comparing source files)

## Acceptance Criteria
- [ ] Every component, hook, context, and utility file present in both `src/renderer/` and `packages/react/src/` is listed
- [ ] Each overlapping file is classified as exactly one of: `identical`, `import-only`, or `behavioral`
- [ ] Classification rationale is documented for `behavioral` entries (describe the divergence)
- [ ] Matrix is appended to the plan document at `/workspace/.ai/task-manager/plans/35--renderer-deduplication/plan-35--renderer-deduplication.md` under a `## Overlap Matrix` heading
- [ ] No files are deleted during this task

## Technical Requirements
- Compare `src/renderer/components/`, `src/renderer/hooks/`, `src/renderer/context/` against `packages/react/src/`
- Classification definitions:
  - `identical`: files are functionally identical (modulo import paths)
  - `import-only`: only difference is import path references (e.g., `../../shared/types` vs `@self-review/core`)
  - `behavioral`: substantive logic differences exist (renderer has extra/different behavior)
- Use `diff` or direct file comparison to determine classification

## Input Dependencies
None — this is a standalone audit task.

## Output Artifacts
- Populated `## Overlap Matrix` section in the plan document listing all classified files

## Implementation Notes

<details>
<summary>Step-by-step approach</summary>

1. List all files under `src/renderer/components/`, `src/renderer/hooks/`, `src/renderer/context/`
2. For each file, check whether a counterpart exists under `packages/react/src/` (same filename or equivalent path)
3. For matching pairs, diff the files:
   - If diffs are only import path differences → `import-only`
   - If diffs are zero (or purely cosmetic whitespace) → `identical`
   - If diffs include logic, JSX structure, or behavior → `behavioral` (document what differs)
4. Build a table: `| File | Renderer Path | Package Path | Classification | Notes |`
5. Append the table to the plan document under `## Overlap Matrix`

Note: Files that exist only in the renderer (no package counterpart) are NOT in dedup scope — do not list them.

Example table format:
```
| File | Renderer Path | Package Path | Classification | Divergence Notes |
|------|--------------|--------------|----------------|------------------|
| FileSection.tsx | src/renderer/components/DiffViewer/FileSection.tsx | packages/react/src/components/DiffViewer/FileSection.tsx | behavioral | renderer has image/SVG preview; package lacks it |
```
</details>
