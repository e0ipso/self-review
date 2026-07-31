---
id: 5
group: 'integration'
dependencies: [2, 4]
status: 'completed'
created: '2026-02-16'
skills:
  - react-components
---

# Integrate Navigation Provider, Keyboard Hook, and Help Footer

## Objective

Mount the `DiffNavigationProvider`, `useKeyboardNavigation` hook, and `HintOverlay` in `App.tsx`, and add a keyboard shortcut help section to the bottom of the FileTree component.

## Skills Required

React component integration and layout.

## Acceptance Criteria

- [ ] `DiffNavigationProvider` wraps Layout in App.tsx
- [ ] `useKeyboardNavigation` hook is called in App.tsx (or a child that has access to the navigation context)
- [ ] `HintOverlay` is rendered in App.tsx consuming the hook's output
- [ ] FileTree has a visually separated "Keyboard Shortcuts" footer section pinned below the file list
- [ ] Footer lists: `f` — Comment on line, `g` — Jump to file, `j/k` — Scroll diffs, `Esc` — Cancel
- [ ] Footer is always visible (not scrolled away with the file list)
- [ ] Complete keyboard navigation workflow works end-to-end: `f` → hint labels → type label → comment input opens
- [ ] Complete file jump workflow works: `g` → hint labels → type label → diff scrolls to file

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Provider hierarchy in App.tsx: `ConfigProvider > ReviewProvider > DiffNavigationProvider > TooltipProvider > ...`
- The `useKeyboardNavigation` hook needs access to `useDiffNavigationContext`, so it must be called inside the provider
- Consider creating a small wrapper component (e.g., `KeyboardNavigationManager`) that calls the hook and renders `HintOverlay`, mounted inside the provider tree
- FileTree help section should use shadcn/ui components for styling consistency (e.g., `Separator`, small text with `text-muted-foreground`)
- Help section should be outside the scrollable file list area so it's always visible

## Input Dependencies

- Task 2: `DiffNavigationProvider` and `useDiffNavigationContext`
- Task 4: `useKeyboardNavigation` hook and `HintOverlay` component

## Output Artifacts

- Updated `App.tsx` with provider and keyboard navigation integration
- Updated `FileTree.tsx` with help footer section
- Fully functional keyboard navigation system

## Implementation Notes

<details>

### App.tsx Integration

In `src/renderer/App.tsx`, wrap the existing layout with `DiffNavigationProvider`:

```tsx
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { KeyboardNavigationManager } from './components/KeyboardNavigationManager';

// In the render:
<ConfigProvider>
  <ReviewProvider>
    <DiffNavigationProvider>
      <TooltipProvider>
        <KeyboardNavigationManager />
        {/* existing Toolbar, Layout, CloseConfirmDialog */}
      </TooltipProvider>
    </DiffNavigationProvider>
  </ReviewProvider>
</ConfigProvider>
```

### KeyboardNavigationManager Component

A small wrapper that ties the hook and overlay together:

```tsx
// src/renderer/components/KeyboardNavigationManager.tsx
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { HintOverlay } from './HintOverlay';

export function KeyboardNavigationManager() {
  const { hints, inputBuffer } = useKeyboardNavigation();
  return <HintOverlay hints={hints} inputBuffer={inputBuffer} />;
}
```

This component has no visible DOM of its own besides the portal-rendered overlay.

### FileTree Help Footer

In `src/renderer/components/FileTree.tsx`, add a section below the scrollable file list. The FileTree currently has a search input at top and a scrollable list. Add a footer after the scrollable area:

```tsx
import { Separator } from './ui/separator';

// After the scrollable file list div:
<Separator />
<div className="px-3 py-2 text-xs text-muted-foreground space-y-1">
  <div className="font-medium text-foreground/70 mb-1">Keyboard Shortcuts</div>
  <div className="flex justify-between"><span>Comment on line</span><kbd className="font-mono">f</kbd></div>
  <div className="flex justify-between"><span>Jump to file</span><kbd className="font-mono">g</kbd></div>
  <div className="flex justify-between"><span>Scroll diffs</span><kbd className="font-mono">j/k</kbd></div>
  <div className="flex justify-between"><span>Cancel</span><kbd className="font-mono">Esc</kbd></div>
</div>
```

The FileTree panel likely uses `flex flex-col` — ensure the file list has `flex-1 overflow-y-auto` and the footer is outside that scrollable area.

</details>
