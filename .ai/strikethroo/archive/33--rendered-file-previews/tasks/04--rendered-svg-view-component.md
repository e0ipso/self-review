---
id: 4
group: renderer
dependencies:
  - 1
status: completed
created: '2026-03-09'
skills:
  - react-components
  - typescript
---
# Build RenderedSvgView Component

## Objective
Create the `RenderedSvgView` React component that renders an SVG file's visual output. Content is extracted from diff addition lines (same technique as `RenderedMarkdownView`) and rendered securely via an `<img>` tag with a `data:image/svg+xml;base64,...` URI to prevent script execution.

## Skills Required
- React components — content extraction from diff hunks, secure SVG rendering
- TypeScript — props interface

## Acceptance Criteria
- [ ] Extracts SVG text from addition lines across all hunks of the `DiffFile`
- [ ] Renders the SVG as `<img src="data:image/svg+xml;base64,...">` — NOT via `dangerouslySetInnerHTML`
- [ ] Applies `max-width: 100%` and `max-height: 80vh` constraints, centred horizontally
- [ ] Shows a graceful fallback message if SVG content cannot be extracted
- [ ] Does NOT render any comment UI — file-level comments are owned by `FileSection`
- [ ] Accepts optional `svgContent?: string` prop for pre-extracted content (React package context)

## Technical Requirements
- File location: `src/renderer/components/DiffViewer/RenderedSvgView.tsx`
- Props:
  ```ts
  interface RenderedSvgViewProps {
    file: DiffFile;
    svgContent?: string; // pre-extracted (React package context)
  }
  ```
- Reuse `extractOriginalCode` from `diff-utils.ts` (same utility used by `RenderedMarkdownView`) or the same inline extraction pattern — filter lines where `type === 'addition'`, slice the leading `+`, join with `\n`
- Data URI construction: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`
  - Use `encodeURIComponent` + `unescape` + `btoa` to handle non-ASCII characters in SVG content
- Centre with `flex justify-center`; wrap in `div` with `p-4` padding

## Input Dependencies
- Task 01: `isPreviewableSvg` utility (informational context)
- `diff-utils.ts` — `extractOriginalCode` function already exists

## Output Artifacts
- `src/renderer/components/DiffViewer/RenderedSvgView.tsx`

## Implementation Notes

<details>
<summary>Implementation details</summary>

```tsx
import React, { useMemo } from 'react';
import type { DiffFile } from '../../../shared/types';

interface RenderedSvgViewProps {
  file: DiffFile;
  svgContent?: string;
}

function extractSvgContent(file: DiffFile): string {
  return file.hunks
    .flatMap(hunk => hunk.lines)
    .filter(line => line.type === 'addition')
    .map(line => line.content.slice(1))
    .join('\n');
}

function svgToDataUri(svgContent: string): string {
  // Handle non-ASCII characters safely
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
}

export default function RenderedSvgView({ file, svgContent: propContent }: RenderedSvgViewProps) {
  const svgContent = useMemo(
    () => propContent ?? extractSvgContent(file),
    [file, propContent]
  );

  if (!svgContent.trim()) {
    return (
      <div className="flex justify-center items-center p-8 text-sm text-muted-foreground">
        SVG content could not be extracted.
      </div>
    );
  }

  const dataUri = svgToDataUri(svgContent);

  return (
    <div className="flex justify-center p-4">
      <img
        src={dataUri}
        alt={file.newPath ?? file.oldPath}
        style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
      />
    </div>
  );
}
```

**Security note**: Rendering via `<img>` tag with a base64 data URI blocks all JavaScript execution inside the SVG, which is the correct approach for untrusted SVG content.

Check `extractOriginalCode` in `diff-utils.ts` — if it already does exactly what the inline extraction above does, import and use it instead to avoid duplication.
</details>
