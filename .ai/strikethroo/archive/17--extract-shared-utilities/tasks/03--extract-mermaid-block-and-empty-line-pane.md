---
id: 3
group: "renderer-components"
dependencies: [1]
status: "completed"
created: "2026-02-18"
skills:
  - react-components
  - typescript
complexity_score: 4
complexity_notes: "Two simple component extractions but depends on task 1 because SplitView.tsx is also modified there"
---

# Extract MermaidBlock.tsx and EmptyLinePane.tsx components

## Objective

Extract two inline sub-components into their own files:
1. `MermaidBlock` from `RenderedMarkdownView.tsx` → `src/renderer/components/DiffViewer/MermaidBlock.tsx`
2. The repeated empty pane JSX from `SplitView.tsx` → `src/renderer/components/DiffViewer/EmptyLinePane.tsx`

## Skills Required

- React components: Extracting self-contained components with their own state and module-level variables
- TypeScript: Correct imports and exports

## Acceptance Criteria

- [ ] `src/renderer/components/DiffViewer/MermaidBlock.tsx` exists with the MermaidBlock component and its module-level variables
- [ ] `src/renderer/components/DiffViewer/EmptyLinePane.tsx` exists as a tiny no-props component
- [ ] `RenderedMarkdownView.tsx` imports MermaidBlock instead of defining it inline
- [ ] `SplitView.tsx` uses EmptyLinePane in all 3 locations where the identical empty JSX was duplicated
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run test:unit` passes with no regressions

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- MermaidBlock has two module-level variables (`mermaidInitialized`, `mermaidIdCounter`) that must move with it
- MermaidBlock dynamically imports `mermaid` — this must continue to work from the new file location
- EmptyLinePane has no props — it renders a fixed `<div>` structure
- This task depends on task 1 because task 1 modifies `SplitView.tsx` (removes inline `getLineBg`/`getGutterBg`). Work on the version of SplitView.tsx that already has task 1's changes applied.

## Input Dependencies

- Task 1 must be complete (SplitView.tsx is modified by task 1)

## Output Artifacts

- New file: `src/renderer/components/DiffViewer/MermaidBlock.tsx`
- New file: `src/renderer/components/DiffViewer/EmptyLinePane.tsx`
- Modified: `src/renderer/components/DiffViewer/RenderedMarkdownView.tsx`
- Modified: `src/renderer/components/DiffViewer/SplitView.tsx`

## Implementation Notes

<details>

### Part A: Extract MermaidBlock

#### Step 1: Create `src/renderer/components/DiffViewer/MermaidBlock.tsx`

Move lines 22-67 from `RenderedMarkdownView.tsx` (the two module-level variables + the component):

```typescript
import React, { useState, useRef, useEffect } from 'react';

let mermaidInitialized = false;
let mermaidIdCounter = 0;

export default function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${mermaidIdCounter++}`);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        const isDark = document.documentElement.classList.contains('dark');

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
          });
          mermaidInitialized = true;
        }

        const { svg: rendered } = await mermaid.render(idRef.current, code);
        if (!cancelled) setSvg(rendered);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className='text-destructive text-sm p-2 border border-destructive/20 rounded'>
        Mermaid error: {error}
      </div>
    );
  }
  if (!svg) return <div className='animate-pulse bg-muted h-32 rounded' />;
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

#### Step 2: Update `RenderedMarkdownView.tsx`

1. Delete lines 20-67 (the `// ===== Mermaid Block =====` comment, the two `let` variables, and the entire `MermaidBlock` function)
2. Add import near the top: `import MermaidBlock from './MermaidBlock';`
3. Remove `useState`, `useRef`, `useEffect` from the react import if they are no longer used directly by RenderedMarkdownView (check first — they may still be used). Keep only the React imports that are still needed.

### Part B: Extract EmptyLinePane

#### Step 3: Create `src/renderer/components/DiffViewer/EmptyLinePane.tsx`

```typescript
import React from 'react';

export default function EmptyLinePane() {
  return (
    <div className='w-1/2 flex'>
      <div className='w-10 flex-shrink-0 bg-muted/20' />
      <div className='flex-1 bg-muted/10' />
    </div>
  );
}
```

#### Step 4: Update `SplitView.tsx`

1. Add import: `import EmptyLinePane from './EmptyLinePane';`
2. Replace the inline empty pane JSX in all locations. There are currently 2 occurrences (old side ~line 263 and new side ~line 272 after task 1's changes — line numbers may shift). Each looks like:
   ```tsx
   <div className='w-1/2 flex'>
     <div className='w-10 flex-shrink-0 bg-muted/20' />
     <div className='flex-1 bg-muted/10' />
   </div>
   ```
   Replace each with: `<EmptyLinePane />`

**Note:** The plan mentions 3 identical JSX blocks, but the current codebase has 2. Search for all occurrences of `bg-muted/20` within SplitView.tsx to find all instances.

### Verification

Run `npx tsc --noEmit` and `npm run test:unit`.

</details>
