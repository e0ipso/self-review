# @self-review/react

Embeddable React components for code review UI: diff viewer, file tree, commenting, and
syntax highlighting.

## Purpose

Reusable UI layer consumed by the Electron renderer and the webapp e2e test harness.
Provides `ReviewPanel` as the main entry point and exports individual components for
custom composition.

## Constraints

- **Browser-only.** No Node.js APIs (`fs`, `child_process`, `path`). This package runs in
  renderer processes and browser environments.
- **No imports from `@self-review/core`.** Core has Node-only dependencies. Importing from
  it — even a single function — risks pulling Node code into the browser bundle. Use
  `@self-review/types` for shared type definitions.
- **`file-type-utils.ts` is duplicated from `@self-review/core`.** The file at
  `src/utils/file-type-utils.ts` is an intentional copy of `packages/core/src/file-type-utils.ts`.
  Both copies must be kept in sync. See the comment in the file for rationale.
- **Adapter pattern for platform integration.** The `ReviewAdapter` interface abstracts
  platform-specific operations (expand context, load images, change output path). The Electron
  app and webapp e2e harness each provide their own adapter implementation.

## Structure

```
src/
├── index.ts              # Barrel export
├── ReviewPanel.tsx        # Main entry component
├── SingleFileReview.tsx   # Single-file review component
├── adapter.ts             # ReviewAdapter interface
├── styles.css             # Tailwind styles
├── components/
│   ├── Layout.tsx         # Two-panel layout (file tree + diff viewer)
│   ├── FileTree.tsx       # File list, search, viewed checkboxes
│   ├── Toolbar.tsx        # View mode, expand/collapse, theme
│   ├── FileTreeEntry.tsx  # Per-file row
│   ├── DiffViewer/        # Diff rendering components
│   └── Comments/          # Comment input, display, suggestions
├── context/               # React context providers
├── hooks/                 # Shared hooks
└── utils/                 # Pure utility functions (browser-safe)
```

## Testing

```bash
npm run test:unit    # from package root, or
npm run test:unit:renderer   # from workspace root
```

Tests are colocated (`*.test.ts` / `*.test.tsx` next to source files). Uses jsdom environment.
