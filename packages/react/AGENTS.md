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

## CSS Build & Theming

### Compiled CSS output

`npm run build` runs `tsup && npm run build:css`. The `build:css` script uses `@tailwindcss/cli`
to compile `src/build-styles.css` into `dist/styles.css` — a self-contained CSS file that includes
all Tailwind utility classes used by the library. Host apps import it as:

```js
import '@self-review/react/styles.css';
```

No Tailwind dependency is needed in the consuming application.

### Build entrypoints

- `src/styles.css` — **build input only**. Contains Tailwind `@custom-variant`/`@theme inline`
  directives, CSS custom property definitions (`:root`, `.dark`), and component-level overrides.
  Do not import this file directly from a host app.
- `src/build-styles.css` — **Tailwind CLI entrypoint**. Imports `tailwindcss`, the typography
  plugin, `styles.css`, and adds `@source "../dist"` to scan compiled JS for class names. Not
  shipped in the package.

### Dependencies

`tailwindcss` and `@tailwindcss/typography` are `devDependencies` (not `peerDependencies`).
Host apps do not need Tailwind in their project.

### `.self-review` wrapper div

`ConfigProvider` renders a `<div className="self-review">` around its children with
`style={{ display: 'contents' }}`. This div serves two purposes:

1. **Theme scoping** — the `dark` class is toggled on this wrapper instead of
   `document.documentElement`. Dark mode utility classes activate via
   `@custom-variant dark (&:is(.dark *))` in `styles.css`.
2. **CSS containment** — all `*` selectors and component-specific overrides in `styles.css` are
   prefixed with `.self-review`, preventing style leakage into host applications.

### Radix/Base UI portal containers

All shadcn/ui portal-based components (`alert-dialog`, `dropdown-menu`, `select`, `tooltip`)
receive the `.self-review` wrapper div as their `container` prop via `useConfig().portalContainer`.
This ensures portals render inside the scoped subtree and inherit dark-mode CSS variables.

The `portalContainer` is `null` on the first render (portals fall back to `document.body`) and
is set to the wrapper div after mount via `useEffect`.

## Testing

```bash
npm run test:unit    # from package root, or
npm run test:unit:renderer   # from workspace root
```

Tests are colocated (`*.test.ts` / `*.test.tsx` next to source files). Uses jsdom environment.
