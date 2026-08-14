---
id: 4
group: 'keyboard-navigation'
dependencies: [1, 2, 3]
status: 'completed'
created: '2026-02-16'
skills:
  - react-components
  - js
complexity_score: 5
complexity_notes: 'Core feature task with multiple interaction modes (hint-diff, hint-file, scroll), label generation algorithm, and DOM coordination. Kept as single task because modes share state machine and key listener.'
---

# Implement useKeyboardNavigation Hook and HintOverlay Component

## Objective

Create the core keyboard navigation hook that manages mode state (`normal`, `hint-diff`, `hint-file`), key event routing, hint label generation, and smooth scrolling — plus the `HintOverlay` React portal component that renders hint badges on target elements.

## Skills Required

React hooks (custom hooks, refs, portals), DOM API (getBoundingClientRect, scrollBy, event listeners).

## Acceptance Criteria

- [ ] `useKeyboardNavigation` hook manages `mode` state: `'normal' | 'hint-diff' | 'hint-file'`
- [ ] In normal mode: `f` enters `hint-diff`, `g` enters `hint-file`, `j`/`k` scroll the diff pane
- [ ] In hint modes: alphanumeric keys match labels, `Escape` returns to normal
- [ ] All keyboard shortcuts are suppressed when focus is on `input`, `textarea`, `[contenteditable]`, or within an MDEditor
- [ ] Hints are dismissed on scroll
- [ ] `HintOverlay` renders as a React portal at document body level
- [ ] For `f` mode: targets `[data-line-number][data-line-side][data-line-type]` where `data-line-type` is `addition` or `deletion`, filtered to viewport-visible elements
- [ ] For `g` mode: targets file entry buttons with `[data-file-path]` in the file tree
- [ ] Label generation uses home-row-first character set, single chars first then two-char combos
- [ ] When a `f` hint is selected: dispatches `trigger-line-comment` custom event with `{ filePath, lineNumber, side }`
- [ ] When a `g` hint is selected: calls `scrollToFile(filePath)` from DiffNavigationContext
- [ ] `j` scrolls diff pane down ~80px, `k` scrolls up ~80px using `scrollBy` with `behavior: 'instant'`
- [ ] Hook returns `{ mode, hints, clearHints }` for the overlay to consume

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- The hook attaches a single `keydown` listener on `document`
- Text input suppression: check `document.activeElement` against `input`, `textarea`, `[contenteditable]`, and ancestor matching `[class*="md-editor"]` or `[data-color-mode]`
- Scroll container is queried via `document.querySelector('[data-scroll-container="diff"]')`
- Hint targets are queried via DOM selectors, filtered by `getBoundingClientRect` to only include viewport-visible elements
- The `filePath` for a diff line hint is found by traversing up to the nearest `[data-file-path]` ancestor
- Label character set (ordered): `a, s, d, f, j, k, l, h, g, q, w, e, r, t, u, i, o, p`; two-char combos if needed (`aa, as, ad, ...`)
- `HintOverlay` is a fixed-position container with absolutely-positioned badge elements using `getBoundingClientRect()` for positioning
- Badges: small, high z-index, colored background (yellow/amber), monospace font, similar to Vimium style

## Input Dependencies

- Task 1: `data-line-type` and `data-scroll-container` attributes on DOM elements
- Task 2: `DiffNavigationContext` providing `scrollToFile`
- Task 3: `trigger-line-comment` custom event listener on FileSection

## Output Artifacts

- `src/renderer/hooks/useKeyboardNavigation.ts`
- `src/renderer/components/HintOverlay.tsx`

## Implementation Notes

<details>

### useKeyboardNavigation.ts

Create `src/renderer/hooks/useKeyboardNavigation.ts`:

**State:**
```typescript
type HintMode = 'normal' | 'hint-diff' | 'hint-file';
interface HintItem { label: string; element: HTMLElement; rect: DOMRect; }

const [mode, setMode] = useState<HintMode>('normal');
const [hints, setHints] = useState<HintItem[]>([]);
const [inputBuffer, setInputBuffer] = useState('');
```

**Text Input Guard:**
```typescript
function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  if (el.closest('[class*="md-editor"]') || el.closest('[data-color-mode]')) return true;
  return false;
}
```

**Key Event Handler (attached to `document` keydown):**
```typescript
// If text input focused, ignore all
if (isTextInputFocused()) return;

if (mode === 'normal') {
  if (key === 'f') { enterHintMode('hint-diff'); }
  else if (key === 'g') { enterHintMode('hint-file'); }
  else if (key === 'j') { scrollDiff(1); }
  else if (key === 'k') { scrollDiff(-1); }
}
else if (mode === 'hint-diff' || mode === 'hint-file') {
  if (key === 'Escape') { clearHints(); return; }
  const newBuffer = inputBuffer + key;
  // Check for exact match
  const match = hints.find(h => h.label === newBuffer);
  if (match) { activateHint(match); clearHints(); return; }
  // Check if any hint starts with buffer
  const partial = hints.some(h => h.label.startsWith(newBuffer));
  if (partial) { setInputBuffer(newBuffer); }
  else { clearHints(); } // No match possible
}
```

**enterHintMode function:**
```typescript
function enterHintMode(newMode: 'hint-diff' | 'hint-file') {
  const targets = newMode === 'hint-diff'
    ? document.querySelectorAll('[data-line-type="addition"], [data-line-type="deletion"]')
    : document.querySelectorAll('.file-tree [data-file-path]');  // Adjust selector as needed

  // Filter to viewport-visible elements
  const visible = Array.from(targets).filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.width > 0 && rect.height > 0;
  });

  if (visible.length === 0) return;

  const labels = generateLabels(visible.length);
  const hintItems = visible.map((el, i) => ({
    label: labels[i],
    element: el as HTMLElement,
    rect: el.getBoundingClientRect(),
  }));

  setMode(newMode);
  setHints(hintItems);
  setInputBuffer('');
}
```

**Label Generation:**
```typescript
const HINT_CHARS = 'asdfjklhgqwertuiop'.split('');

function generateLabels(count: number): string[] {
  if (count <= HINT_CHARS.length) return HINT_CHARS.slice(0, count);
  const labels: string[] = [];
  for (const a of HINT_CHARS) {
    for (const b of HINT_CHARS) {
      labels.push(a + b);
      if (labels.length >= count) return labels;
    }
  }
  return labels;
}
```

**activateHint function:**
```typescript
function activateHint(hint: HintItem) {
  if (mode === 'hint-diff') {
    const lineNumber = parseInt(hint.element.getAttribute('data-line-number') || '0');
    const side = hint.element.getAttribute('data-line-side') as 'old' | 'new';
    const fileSection = hint.element.closest('[data-file-path]');
    const filePath = fileSection?.getAttribute('data-file-path') || '';
    document.dispatchEvent(new CustomEvent('trigger-line-comment', {
      bubbles: true,
      detail: { filePath, lineNumber, side }
    }));
  } else if (mode === 'hint-file') {
    const filePath = hint.element.getAttribute('data-file-path') || '';
    scrollToFile(filePath); // from DiffNavigationContext
  }
}
```

**Scroll function:**
```typescript
const SCROLL_AMOUNT = 80; // ~3-4 lines
function scrollDiff(direction: 1 | -1) {
  const container = document.querySelector('[data-scroll-container="diff"]');
  if (container) {
    container.scrollBy({ top: direction * SCROLL_AMOUNT, behavior: 'instant' });
  }
}
```

**Dismiss on scroll:**
Add a scroll event listener on the diff container that calls `clearHints()` when hints are active.

### HintOverlay.tsx

Create `src/renderer/components/HintOverlay.tsx`:

```tsx
import React from 'react';
import { createPortal } from 'react-dom';

interface HintItem { label: string; element: HTMLElement; rect: DOMRect; }

interface HintOverlayProps {
  hints: HintItem[];
  inputBuffer: string;
}

export function HintOverlay({ hints, inputBuffer }: HintOverlayProps) {
  if (hints.length === 0) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {hints.map((hint) => (
        <span
          key={hint.label}
          style={{
            position: 'absolute',
            left: hint.rect.left,
            top: hint.rect.top,
            backgroundColor: '#facc15', // yellow-400
            color: '#000',
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 'bold',
            padding: '1px 3px',
            borderRadius: '2px',
            lineHeight: 1,
            zIndex: 9999,
          }}
        >
          {/* Highlight already-typed chars */}
          <span style={{ opacity: 0.4 }}>{hint.label.slice(0, inputBuffer.length)}</span>
          <span>{hint.label.slice(inputBuffer.length)}</span>
        </span>
      ))}
    </div>,
    document.body
  );
}
```

The hook should return `{ mode, hints, inputBuffer, clearHints }` so App.tsx can render the overlay.

</details>
