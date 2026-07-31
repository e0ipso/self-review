---
id: 1
group: "prism-loading"
dependencies: []
status: "completed"
created: "2026-03-16"
skills:
  - typescript
---
# Consolidate Prism Loading to Static Imports in SyntaxLine

## Objective
Replace the broken dynamic `import('prismjs')` path in `SyntaxLine.tsx` with static imports, matching the pattern already used in `SuggestionBlock.tsx`. This eliminates bundling failures when tsup externalizes prismjs and removes the redundant dual-loading architecture.

## Skills Required
- TypeScript (refactoring module imports, simplifying React component logic)

## Acceptance Criteria
- [ ] `SyntaxLine.tsx` uses `import Prism from 'prismjs'` (value import, not type-only)
- [ ] All ~35 language grammars from `loadPrism()` are statically imported (preserving dependency order)
- [ ] `loadPrism()` function, `prismInstance`, and `prismReady` module-level variables are removed
- [ ] Component simplified: no `useState`, no async `useEffect`, just `useMemo` with `highlight(Prism, content, language)`
- [ ] The sync `useEffect` that kept `html` in sync with `memoHtml` is also removed
- [ ] `SuggestionBlock.tsx` static imports left unchanged (redundant but harmless)
- [ ] `npm run build` in `packages/react` succeeds
- [ ] `grep -c 'loadPrism' packages/react/dist/index.js` returns 0

## Technical Requirements
- Prism grammar dependency order must be preserved (markup → markup-templating → css → clike → javascript, etc.)
- The complete grammar list from the current `loadPrism()` function (lines 21–61 of SyntaxLine.tsx)
- `escapeHtml()` and `highlight()` helper functions remain unchanged
- The `getLanguageFromPath` re-export remains unchanged

## Input Dependencies
None — this task has no dependencies on other tasks.

## Output Artifacts
- Modified `packages/react/src/components/DiffViewer/SyntaxLine.tsx` with static Prism imports and simplified component

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### File: `packages/react/src/components/DiffViewer/SyntaxLine.tsx`

**Step 1: Replace the type-only import with a value import**
```typescript
// BEFORE (line 2)
import type Prism from 'prismjs';

// AFTER
import Prism from 'prismjs';
```

**Step 2: Add static grammar imports after the Prism import**

Add these imports in exactly this order (dependency-sensitive):
```typescript
// Base language components (order-sensitive)
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
// JavaScript family
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
// Other common languages
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-twig';
// Config and data formats
import 'prismjs/components/prism-ini';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-csv';
import 'prismjs/components/prism-diff';
// Web and infrastructure
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-sass';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-nginx';
import 'prismjs/components/prism-docker';
// Database and tooling
import 'prismjs/components/prism-mongodb';
import 'prismjs/components/prism-makefile';
import 'prismjs/components/prism-git';
import 'prismjs/components/prism-vim';
import 'prismjs/components/prism-xml-doc';
```

**Step 3: Remove the module-level cache variables and `loadPrism()` function**

Delete lines 7–68 (the `prismInstance`, `prismReady` variables and the entire `loadPrism()` function).

**Step 4: Simplify the component**

Replace the current component body with:
```typescript
const SyntaxLine = React.memo(function SyntaxLine({
  content,
  language,
  lineType: _lineType,
  wordWrap,
}: SyntaxLineProps) {
  const html = useMemo(() => highlight(Prism, content, language), [content, language]);

  return (
    <code
      className={`font-mono text-[13px] ${wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'} block`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
```

**Step 5: Update React imports**

Change `import React, { useState, useMemo, useEffect } from 'react'` to `import React, { useMemo } from 'react'` since `useState` and `useEffect` are no longer used.

</details>
