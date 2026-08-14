---
id: 1
group: "frontmatter-rendering"
dependencies: []
status: "completed"
created: 2026-03-26
skills:
  - react
  - typescript
  - yaml-parsing
---
# Create Front Matter Parser Utility, shadcn Table Component, and FrontMatterTable Component

## Objective
Create three artifacts: (1) a `parseFrontMatter` utility that extracts YAML front matter from markdown content, (2) add the shadcn/ui `<Table>` component to the project, and (3) a `FrontMatterTable` React component that renders parsed YAML metadata as a styled table.

## Skills Required
- React component development (recursive rendering)
- YAML parsing with the `yaml` package
- shadcn/ui component patterns

## Acceptance Criteria
- [ ] `parseFrontMatter(content: string)` utility exists in `packages/react/src/utils/front-matter.ts`
- [ ] Returns `{ metadata: Record<string, unknown>, body: string, lineOffset: number }` when valid front matter exists
- [ ] Returns `null` when no valid front matter is present
- [ ] Handles malformed YAML gracefully (try/catch, returns null)
- [ ] `lineOffset` counts lines consumed by front matter block including both `---` delimiters
- [ ] shadcn/ui Table component added at `packages/react/src/components/ui/table.tsx`
- [ ] `FrontMatterTable` component exists in `packages/react/src/components/DiffViewer/FrontMatterTable.tsx`
- [ ] Scalar values (string, number, boolean, null) render as plain text
- [ ] Array values render as `<ul>` with `<li>` items (recursive)
- [ ] Object values render as nested `<table>` (recursive)
- [ ] Uses shadcn/ui `<Table>` components for styling
- [ ] Unit tests for `parseFrontMatter` covering: valid front matter, no front matter, malformed YAML, front matter with arrays/objects, `---` horizontal rule (not front matter)
- [ ] Unit tests for `FrontMatterTable` covering: scalar/array/object rendering

## Technical Requirements
- Use the `yaml` package (already installed at workspace root, v2.8.2) for YAML parsing
- Add `yaml` to `packages/react/package.json` dependencies
- Add shadcn/ui Table component (`packages/react/src/components/ui/table.tsx`) — follow the pattern of existing shadcn components in that directory
- Front matter detection: opening `---` must be the very first line, closing `---` must exist
- The component should be styled within a `prose` container context

## Input Dependencies
None — this is the foundational task.

## Output Artifacts
- `packages/react/src/utils/front-matter.ts` — parser utility
- `packages/react/src/utils/front-matter.test.ts` — parser tests
- `packages/react/src/components/ui/table.tsx` — shadcn Table component
- `packages/react/src/components/DiffViewer/FrontMatterTable.tsx` — table component
- `packages/react/src/components/DiffViewer/FrontMatterTable.test.tsx` — component tests

## Implementation Notes
- Look at `packages/core/src/config.ts` for an example of `yaml` usage in this project
- Follow the shadcn/ui Table component pattern from https://ui.shadcn.com/docs/components/table — the component exports `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
- The recursive value renderer should be a helper function within FrontMatterTable, not a separate file
- Use `@testing-library/react` for component tests (already used in the project)
