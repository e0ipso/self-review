---
id: 2
group: 'foundation'
dependencies: []
status: 'completed'
created: '2026-02-16'
skills:
  - react-components
---

# Create Shared DiffNavigationContext Provider

## Objective

Extract the `scrollToFile` function and active-file tracking from the `useDiffNavigation` hook into a shared React context provider, so both the FileTree (click navigation) and the keyboard hint system (programmatic navigation) use the same navigation source.

## Skills Required

React context/provider architecture and hook refactoring.

## Acceptance Criteria

- [ ] New `src/renderer/context/DiffNavigationContext.tsx` exports a `DiffNavigationProvider` and a `useDiffNavigationContext` consumer hook
- [ ] The provider exposes `scrollToFile(filePath: string)` and `activeFilePath: string | null`
- [ ] `useDiffNavigation.ts` is refactored to use the shared context internally (or is replaced by it)
- [ ] `FileTree.tsx` consumes `scrollToFile` from the new context instead of calling the hook directly
- [ ] Existing file-tree click navigation still works identically
- [ ] Active file highlighting in the file tree still works

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- The existing `useDiffNavigation` hook (in `src/renderer/hooks/useDiffNavigation.ts`) contains `scrollToFile` (uses `document.querySelector('[data-file-path="..."]')` + `scrollIntoView`) and an `IntersectionObserver` for tracking the active file
- The provider should wrap `Layout` (or be placed in `App.tsx`) so both FileTree and DiffViewer have access
- No changes to IPC or shared types needed

## Input Dependencies

None — can be done in parallel with task 1.

## Output Artifacts

- `DiffNavigationContext.tsx` provider file
- Updated `useDiffNavigation.ts` (simplified or removed)
- Updated `FileTree.tsx` and any other consumers

## Implementation Notes

<details>

### Step 1: Create DiffNavigationContext.tsx

Create `src/renderer/context/DiffNavigationContext.tsx`:

```tsx
import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';

interface DiffNavigationContextValue {
  scrollToFile: (filePath: string) => void;
  activeFilePath: string | null;
}

const DiffNavigationContext = createContext<DiffNavigationContextValue | null>(null);

export function DiffNavigationProvider({ children }: { children: React.ReactNode }) {
  // Move the scrollToFile and IntersectionObserver logic from useDiffNavigation here
  // scrollToFile: query `[data-file-path="..."]` and scrollIntoView
  // IntersectionObserver: watch `[data-file-path]` elements, track activeFilePath

  return (
    <DiffNavigationContext.Provider value={{ scrollToFile, activeFilePath }}>
      {children}
    </DiffNavigationContext.Provider>
  );
}

export function useDiffNavigationContext() {
  const ctx = useContext(DiffNavigationContext);
  if (!ctx) throw new Error('useDiffNavigationContext must be used within DiffNavigationProvider');
  return ctx;
}
```

### Step 2: Migrate logic from useDiffNavigation.ts

Move the `scrollToFile` callback and the `IntersectionObserver` setup (lines 11-44 of current `useDiffNavigation.ts`) into the provider. The existing hook currently returns `{ scrollToFile, activeFilePath }` — the context value should match this shape.

The existing `useDiffNavigation` hook can be kept as a thin wrapper that calls `useDiffNavigationContext()` for backward compatibility, or consumers can be updated to call the context directly.

### Step 3: Update FileTree.tsx

In `FileTree.tsx`, replace the `useDiffNavigation()` import/call with `useDiffNavigationContext()`. The returned `scrollToFile` and `activeFilePath` have the same interface.

### Step 4: Mount in App.tsx

Add `<DiffNavigationProvider>` to the provider hierarchy in `App.tsx`. It should wrap the components that need it (at minimum `Layout` which contains both `FileTree` and `DiffViewer`). Place it inside `ReviewProvider` but outside `TooltipProvider`.

</details>
