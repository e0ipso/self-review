---
id: 1
group: "findbar-fix"
dependencies: []
status: "completed"
created: "2026-02-27"
skills:
  - react-components
  - typescript
---
# Fix FindBar to Use Enter-to-Search Instead of Auto-Search

## Objective
Modify the `FindBar` component to eliminate the auto-search `useEffect` that triggers `findInPage()` on every keystroke (which causes Chromium to steal focus), and instead only trigger searches on Enter/Shift+Enter. Preserve the clear-highlights-on-empty behavior and add refocus-after-search.

## Skills Required
- `react-components`: Modifying React hooks, refs, and effects in the FindBar component
- `typescript`: TypeScript-specific patterns in the Electron renderer process

## Acceptance Criteria
- [ ] User can type a full multi-character query in the Ctrl+F Find bar without focus loss
- [ ] Pressing Enter triggers the search and highlights matches
- [ ] Enter and Shift+Enter cycle through matches (existing behavior preserved)
- [ ] Clearing the input removes search highlights and resets match counters
- [ ] Escape still closes the Find bar
- [ ] Vimium-style shortcuts (`f`, `g`, `j`, `k`) remain suppressed while the Find bar input is focused

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Electron/Chromium `webContents.findInPage()` API (called via `window.electronAPI.findInPage()`)
- React hooks: `useEffect`, `useCallback`, `useRef`
- `requestAnimationFrame` for post-search refocusing

## Input Dependencies
None — this is the first task.

## Output Artifacts
- Modified `src/renderer/components/FindBar.tsx` with Enter-to-search behavior

## Implementation Notes

<details>
<summary>Detailed implementation instructions</summary>

### File to modify: `src/renderer/components/FindBar.tsx`

### Change 1: Remove the auto-search `useEffect` (lines 144-163)

Delete the entire `useEffect` block at lines 144-163 that watches `[isOpen, query]` and calls `findInPage()` on query change. This is the direct cause of the focus-stealing bug.

```tsx
// DELETE THIS ENTIRE BLOCK (lines 144-163):
useEffect(() => {
  if (!isOpen || !query) {
    if (!query && lastSearchedQueryRef.current) {
      window.electronAPI.stopFindInPage('clearSelection');
      setActiveMatch(0);
      setTotalMatches(0);
      lastSearchedQueryRef.current = '';
    }
    return;
  }

  if (query !== lastSearchedQueryRef.current) {
    window.electronAPI.findInPage({ text: query, forward: true, findNext: false });
    window.electronAPI.findInPage({ text: query, forward: true, findNext: true });
    lastSearchedQueryRef.current = query;
  }
}, [isOpen, query]);
```

### Change 2: Preserve clear-on-empty behavior

The removed effect also handled clearing highlights when query becomes empty (lines 146-153). Add a **new, minimal effect** that only watches for the query becoming empty:

```tsx
// Clear highlights when query is emptied
useEffect(() => {
  if (!query && lastSearchedQueryRef.current) {
    window.electronAPI.stopFindInPage('clearSelection');
    setActiveMatch(0);
    setTotalMatches(0);
    lastSearchedQueryRef.current = '';
  }
}, [query]);
```

Alternatively, this logic can be inlined in the `onChange` handler of the Input element.

### Change 3: Add refocus in `onFindResult` callback

In the `onFindResult` subscription effect (lines 94-106), after updating match counters, add a `requestAnimationFrame`-wrapped refocus to restore focus to the input after Chromium steals it during `findInPage()`:

Replace line 101 (`// Don't refocus - let the global Enter handler work without input focus`) with:

```tsx
// Refocus input after Chromium's findInPage steals focus
requestAnimationFrame(() => {
  inputRef.current?.focus();
});
```

The updated effect should look like:

```tsx
useEffect(() => {
  if (!isOpen) return;

  const unsubscribe = window.electronAPI.onFindResult((result: FindInPageResult) => {
    if (result.finalUpdate) {
      setActiveMatch(result.activeMatchOrdinal);
      setTotalMatches(result.matches);
      // Refocus input after Chromium's findInPage steals focus
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  });

  return unsubscribe;
}, [isOpen]);
```

### Summary of changes
1. Delete the auto-search `useEffect` (lines 144-163)
2. Add a minimal clear-on-empty effect (or inline in onChange)
3. Add `requestAnimationFrame` refocus in `onFindResult` callback (replacing the comment at line 101)

### What NOT to change
- The `findNext()` and `findPrevious()` callbacks — they already handle Enter/Shift+Enter via `handleKeyDown`
- The global keydown listener — it provides a safety net if focus is lost
- The close-on-close effect (lines 165-174) — already correct
- The auto-focus-on-open effect (lines 86-91) — already correct

</details>
