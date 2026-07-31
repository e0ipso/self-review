---
id: 1
group: "prismjs-lazy-load"
dependencies: []
status: "completed"
created: 2026-03-11
skills:
  - react-components
  - typescript
---
# Refactor SyntaxLine.tsx to Hybrid Lazy-Load Prism.js

## Objective
Remove all 44 static `import` statements for Prism.js and replace them with a single dynamic `import()` call that loads Prism and all grammar side-effects exactly once per module lifecycle. Use a hybrid rendering strategy (`useMemo` + `useEffect` + `useState`) so subsequent component mounts highlight synchronously (zero flicker), with only the very first cold-load producing one plain-text frame.

## Skills Required
- **react-components**: React hooks — `useState`, `useMemo`, `useEffect` — and hybrid rendering pattern
- **typescript**: Dynamic `import()` typing, `typeof Prism | null` annotation, module-level Promise caching

## Acceptance Criteria
- [ ] `SyntaxLine.tsx` contains zero top-level `import 'prismjs'` or `import 'prismjs/components/...'` statements
- [ ] A module-level `loadPrism()` function returns a cached `Promise<typeof Prism>` and populates `prismInstance` exactly once
- [ ] Grammar imports inside `loadPrism()` preserve the identical ordering as the removed static imports (dependency constraint documented in a code comment)
- [ ] `useMemo` uses `prismInstance` synchronously when non-null; returns escaped plain text when null
- [ ] `useEffect` is a no-op when `prismInstance !== null`; otherwise calls `loadPrism()` and updates state with highlighted HTML on resolution
- [ ] `useEffect` includes a `cancelled` cleanup flag to discard stale resolutions when `content`/`language` change mid-load
- [ ] Component props, output shape (`dangerouslySetInnerHTML`), and exported API are unchanged
- [ ] All existing unit tests in `packages/react` pass without modification

## Technical Requirements
- File: `packages/react/src/components/DiffViewer/SyntaxLine.tsx`
- Module-level state pattern:
  ```ts
  let prismInstance: typeof Prism | null = null;
  let prismReady: Promise<typeof Prism> | null = null;

  function loadPrism(): Promise<typeof Prism> {
    if (!prismReady) {
      prismReady = import('prismjs').then(async (mod) => {
        await import('prismjs/components/prism-markup');
        await import('prismjs/components/prism-markup-templating');
        // … remaining grammars in identical order to previous static imports …
        prismInstance = mod.default;
        return mod.default;
      });
    }
    return prismReady;
  }
  ```
- Component rendering pattern:
  1. `useMemo([content, language])` — if `prismInstance` is non-null, call `Prism.highlight(content, grammar, language)` synchronously; otherwise return HTML-escaped plain text
  2. `useState(memoResult)` — initialised from the memo value (highlighted on warm load, plain text on cold)
  3. `useEffect([content, language])` — if `prismInstance !== null` return immediately; otherwise call `loadPrism()` and on resolution set state (guarded by `cancelled` flag)
- `@types/prismjs` is already a dev dependency — use existing type definitions

## Input Dependencies
None — this is a standalone refactor of an existing file.

## Output Artifacts
- Modified `packages/react/src/components/DiffViewer/SyntaxLine.tsx` with zero static Prism imports and hybrid lazy-load implementation

## Implementation Notes

<details>
<summary>Step-by-step implementation guide</summary>

### 1. Read the current file first
Open `packages/react/src/components/DiffViewer/SyntaxLine.tsx` and note:
- The full list of static import statements (Prism core + all grammar side-effects)
- The exact order of grammar imports — this order MUST be preserved in `loadPrism()`
- How `Prism.highlight(...)` is currently called and what props/state feed into it

### 2. Remove all static Prism imports
Delete every line matching:
```ts
import Prism from 'prismjs';
import 'prismjs/components/prism-...';
```

### 3. Add module-level cache variables (above the component)
```ts
import type Prism from 'prismjs'; // type-only import is fine for the type annotation

let prismInstance: typeof Prism | null = null;
let prismReady: Promise<typeof Prism> | null = null;
```

### 4. Implement `loadPrism()`
```ts
function loadPrism(): Promise<typeof Prism> {
  if (!prismReady) {
    prismReady = import('prismjs').then(async (mod) => {
      // IMPORTANT: grammar load order must match the previous static imports.
      // Some grammars depend on others (e.g. prism-markup-templating before prism-php).
      await import('prismjs/components/prism-markup');
      await import('prismjs/components/prism-markup-templating');
      // … copy remaining grammar imports from the old static list in exact order …
      prismInstance = mod.default ?? (mod as unknown as typeof Prism);
      return prismInstance;
    });
  }
  return prismReady;
}
```

### 5. Refactor the component body
Replace the existing highlighting logic with the hybrid pattern:

```tsx
const SyntaxLine: React.FC<SyntaxLineProps> = ({ content, language, /* ...other props */ }) => {
  const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const highlighted = useMemo(() => {
    if (prismInstance && language) {
      const grammar = prismInstance.languages[language];
      if (grammar) {
        return prismInstance.highlight(content, grammar, language);
      }
    }
    return escapeHtml(content);
  }, [content, language]);

  const [html, setHtml] = useState(highlighted);

  // Sync html when memo already has highlighted result (warm load)
  useEffect(() => {
    setHtml(highlighted);
  }, [highlighted]);

  useEffect(() => {
    if (prismInstance) return; // Already loaded — useMemo handles it
    let cancelled = false;
    loadPrism().then((Prism) => {
      if (cancelled) return;
      const grammar = language ? Prism.languages[language] : undefined;
      setHtml(grammar ? Prism.highlight(content, grammar, language!) : escapeHtml(content));
    });
    return () => { cancelled = true; };
  }, [content, language]);

  return <code dangerouslySetInnerHTML={{ __html: html }} />;
  // (restore actual JSX structure and className props from the original — don't change the shape)
};
```

> **Note**: The exact JSX output must match the current component. Only the data-flow logic changes — do not alter classNames, data attributes, or the surrounding span/code structure.

### 6. Verify grammar ordering
After moving grammar imports into `loadPrism()`, cross-check the order against what was in the static imports. Leave a comment:
```ts
// Grammar load order matters: markup-templating must precede php, twig, smarty, etc.
```

### 7. Run existing tests
```bash
npm run test:unit:renderer
```
All tests should pass. If `DiffViewer.test.tsx` was previously relying on the `./FileSection` mock to avoid loading Prism, it should now work whether or not that mock is present, because Prism is no longer in the static module graph.

</details>
