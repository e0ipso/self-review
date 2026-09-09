# @self-review/core

Node.js library for diff parsing, git operations, XML serialization, configuration, and
file system utilities.

## Purpose

Headless business logic consumed by the Electron main process. Provides the complete pipeline
from CLI args → git diff → parsed AST → XML output.

## Constraints

- **Node.js only.** This package uses `child_process`, `fs`, and Node-only libraries
  (`xmllint-wasm`, `fast-xml-parser`, `yaml`, `ignore`). It cannot be imported in browser
  or renderer code.
- **No imports from `@self-review/react`.** Dependency flows one way: `core` depends on
  `types`, never on `react`.
- **`file-type-utils.ts` is duplicated in `@self-review/react`.** The functions in this file
  (`getLanguageFromPath`, `isPreviewableImage`, `isPreviewableSvg`) are pure string utilities
  with no Node dependencies. They are intentionally duplicated in
  `packages/react/src/utils/file-type-utils.ts` to avoid forcing `react` to depend on this
  package. Keep both copies in sync when changing the logic.

## Structure

```
src/
├── index.ts              # Barrel export
├── types.ts              # Re-exports from @self-review/types
├── diff-parser.ts        # Unified diff → DiffFile[]
├── git.ts                # child_process wrappers for git
├── xml-serializer.ts     # ReviewState → XML (validates against XSD)
├── xml-parser.ts         # XML → ReviewState
├── config.ts             # YAML config loading & merging
├── synthetic-diff.ts     # Diffs for non-git directories
├── directory-scanner.ts  # File/directory scanning
├── payload-sizing.ts     # Large-payload threshold checks
├── ignore-filter.ts      # .gitignore-style filtering
├── fs-utils.ts           # File system helpers
└── file-type-utils.ts    # File extension → language/preview detection
```

## Testing

```bash
npm run test:unit    # from package root, or
npm run test:unit --workspace @self-review/core   # from workspace root
```

Tests are colocated (`*.test.ts` next to source files). `npm run test:unit:main` from the
workspace root does not run these tests despite the similar name — that script targets
`vitest.config.main.ts`, which is scoped to the desktop main-process suite
(`src/main/**/*.test.ts`), a separate suite from this package.
