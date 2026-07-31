---
id: 5
group: "rendered-markdown-view"
dependencies: [3, 4]
status: "completed"
created: "2026-02-18"
skills: ["react-components"]
---

# Integrate Raw/Rendered Toggle in FileSection Header

## Objective

Add a per-file "Raw / Rendered" toggle button to `FileSection`'s header bar for eligible markdown files (`changeType === 'added'` AND file extension `.md` or `.markdown`). When toggled to "Rendered", render `RenderedMarkdownView` instead of `UnifiedView`/`SplitView`.

## Skills Required

React component development — modifying the existing `FileSection.tsx` component, adding conditional rendering logic.

## Acceptance Criteria

- [ ] Markdown files with `changeType === 'added'` show a toggle button in the file header
- [ ] Non-markdown files do NOT show the toggle
- [ ] Modified/deleted/renamed markdown files do NOT show the toggle
- [ ] Toggle defaults to "Raw" (existing behavior)
- [ ] Clicking toggle switches between raw diff view and `RenderedMarkdownView`
- [ ] Toggle state is local to each file section (per-file, not global)
- [ ] The toggle button uses shadcn/ui components and fits visually in the existing header bar
- [ ] When in "Rendered" mode, the split/unified view mode selector is irrelevant (rendered view is always single-column)

## Technical Requirements

- Modify `src/renderer/components/DiffViewer/FileSection.tsx`.
- Add a local state: `const [markdownViewMode, setMarkdownViewMode] = useState<'raw' | 'rendered'>('raw');`
- Eligibility check: `file.changeType === 'added' && /\.(md|markdown)$/i.test(file.newPath || file.oldPath || '')`
- In the header bar (near the existing viewed/comment buttons), add the toggle.
- Use shadcn/ui `Button` with variant toggling (e.g., two small buttons "Raw" / "Rendered" with active state styling, or a shadcn `ToggleGroup`).
- When `markdownViewMode === 'rendered'`, render `<RenderedMarkdownView file={file} />` instead of the existing `UnifiedView`/`SplitView`.

## Input Dependencies

Task 3: Gutter and comment interaction working in `RenderedMarkdownView`.
Task 4: Mermaid rendering integrated.

## Output Artifacts

- Modified `FileSection.tsx` with toggle logic
- The feature is fully functional end-to-end

## Implementation Notes

<details>

### Eligibility helper

```typescript
function isEligibleForRenderedView(file: DiffFile): boolean {
  const path = file.newPath || file.oldPath || '';
  return file.changeType === 'added' && /\.(md|markdown)$/i.test(path);
}
```

### Toggle button placement

Look at the existing header bar in `FileSection.tsx`. The header contains:
- Expand/collapse chevron
- File path
- Change type badge
- Viewed checkbox
- Comment count

Add the Raw/Rendered toggle near the change type badge or after it. Use a small toggle group:

```tsx
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';

// Inside the header, conditionally:
{isEligibleForRenderedView(file) && (
  <ToggleGroup
    type="single"
    value={markdownViewMode}
    onValueChange={(v) => v && setMarkdownViewMode(v as 'raw' | 'rendered')}
    size="sm"
  >
    <ToggleGroupItem value="raw" aria-label="Raw view">Raw</ToggleGroupItem>
    <ToggleGroupItem value="rendered" aria-label="Rendered view">Rendered</ToggleGroupItem>
  </ToggleGroup>
)}
```

**Note**: Check if shadcn/ui `ToggleGroup` is already installed in the project. If not, use two `Button` components with active/inactive variants instead. Do NOT install new shadcn components unless necessary — check `src/renderer/components/ui/` for available components.

### Conditional rendering

In the body section of `FileSection`, where `UnifiedView` or `SplitView` is currently rendered:

```tsx
{markdownViewMode === 'rendered' && isEligibleForRenderedView(file) ? (
  <RenderedMarkdownView file={file} />
) : viewMode === 'split' ? (
  <SplitView ... />
) : (
  <UnifiedView ... />
)}
```

### Import

```typescript
import RenderedMarkdownView from './RenderedMarkdownView';
```

### Testing the integration

After implementing, verify:
1. A new `.md` file shows the toggle
2. A modified `.md` file does NOT show the toggle
3. A new `.ts` file does NOT show the toggle
4. Toggling between Raw/Rendered preserves comments
5. Comments added in Rendered view appear in Raw view

</details>
