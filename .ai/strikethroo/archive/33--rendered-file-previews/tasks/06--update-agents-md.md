---
id: 6
group: documentation
dependencies:
  - 5
status: completed
created: '2026-03-09'
skills:
  - documentation
---
# Update AGENTS.md Documentation

## Objective
Update `AGENTS.md` to document the new `diff:load-image` IPC channel and the rendered preview capabilities for images and SVGs.

## Skills Required
Documentation — Markdown editing, keeping existing table structure consistent.

## Acceptance Criteria
- [ ] IPC Channels table in `AGENTS.md` has a new row for `diff:load-image`
- [ ] The project structure or architecture section notes that raster images and SVGs support rendered previews (similar to Markdown)
- [ ] Supported image formats are listed: JPG, PNG, GIF, WebP, ICO, BMP, SVG

## Technical Requirements
- Follow the existing table format in the IPC Channels section exactly
- `diff:load-image` row:
  - Channel: `diff:load-image`
  - Direction: Renderer → Main
  - Payload: `{ filePath: string }` / `ImageLoadResult`
  - Purpose: Load a binary image file as a base64 data URI for preview

## Input Dependencies
- Task 05 must be complete so the documented behaviour is final

## Output Artifacts
- Updated `AGENTS.md`

## Implementation Notes

<details>
<summary>Implementation details</summary>

Locate the IPC Channels table in `AGENTS.md`. Add the row in the appropriate position (alphabetical or logical order alongside `diff:load-file`):

```markdown
| `diff:load-image`  | Renderer → Main | `{ filePath }` / `ImageLoadResult` | Load a binary image as base64 data URI for rendered preview |
```

Also find the section describing rendered views (likely near the Markdown / `RenderedMarkdownView` mention) and add a note that raster images (JPG, PNG, GIF, WebP, ICO, BMP) and SVG files newly added in a diff also support Raw/Rendered toggle preview, following the same `changeType === 'added'` eligibility rule.
</details>
