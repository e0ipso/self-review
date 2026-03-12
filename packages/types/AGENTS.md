# @self-review/types

Shared TypeScript type definitions for the self-review workspace. Zero runtime dependencies.

## Purpose

Single source of truth for all data structures shared across packages and the Electron app.
Both `@self-review/core` and `@self-review/react` depend on this package. The Electron app's
`src/shared/types.ts` re-exports from here.

## Constraints

- **Zero runtime dependencies.** This package must never add runtime `dependencies` in
  `package.json`. It exists solely for type exports.
- **Types only.** No runtime code, no utility functions, no constants. If it emits JavaScript,
  it does not belong here.
- **No imports from sibling packages.** This is a leaf dependency — it must never import from
  `@self-review/core` or `@self-review/react`.

## Structure

All types live in `src/index.ts`. No subdirectories needed at current scale.
