---
id: 2
group: "single-file-review-adapter"
dependencies: [1]
status: "completed"
created: 2026-05-02
skills:
  - typescript
  - unit-testing
---

# Test the SingleFileReview adapter-merge behavior

## Objective

Add a focused Vitest test alongside `SingleFileReview.tsx` that verifies the three load-bearing behaviors of the new `adapter` prop:

1. A consumer-supplied `expandContext` is invoked through the provider plumbing when triggered.
2. A consumer-supplied `loadDiff` is **ignored** — the internally-generated `loadDiff` returns the file/source-derived payload regardless.
3. Rendering with no `adapter` prop matches the prior behavior (no errors, `expandContext` is `undefined` on the merged adapter).

## Skills Required

- `unit-testing` — Vitest + React Testing Library; render the component, capture the merged adapter via `useAdapter()`, assert behavior.
- `typescript` — author the test fixtures with the existing shared types.

## Acceptance Criteria

- [ ] New file `packages/react/src/SingleFileReview.test.tsx` exists.
- [ ] Test asserts that when `adapter={{ expandContext: stub }}` is passed, calling the merged adapter's `expandContext` runs the stub with the supplied `ExpandContextRequest`.
- [ ] Test asserts that when `adapter={{ loadDiff: stub }}` is passed, calling the merged adapter's `loadDiff` returns `{ files: [file], source }` derived from the props (the stub is not invoked).
- [ ] Test asserts that when no `adapter` prop is passed, the merged adapter exposes only `loadDiff` (`expandContext`, `loadFileContent`, etc. are `undefined`).
- [ ] All three tests pass: `npx vitest run packages/react/src/SingleFileReview.test.tsx` exits 0.
- [ ] `npm run test:unit:renderer` from the workspace root passes (no regressions in the rest of the renderer suite).

## Technical Requirements

- Test runner: Vitest with `jsdom` (already configured for `packages/react`).
- Use `@testing-library/react`'s `render` to mount the component.
- Capture the merged adapter by rendering a tiny child component inside `SingleFileReview` that calls `useAdapter()` and writes the value to a captured ref or callback. Two viable approaches:

  **Approach A — render a probe via a portal-free child.** `SingleFileReview` does not accept children; instead, render `SingleFileReview` and use a top-level wrapper that exposes the adapter. The cleanest path is to render `SingleFileReview` *and separately* invoke `useAdapter()` from within the same provider tree by composing through a custom test child via `<ReviewAdapterProvider>` directly — but this defeats the purpose. **Use Approach B instead.**

  **Approach B (recommended) — spy on `ReviewAdapterProvider`.** Use `vi.mock` to replace `ReviewAdapterProvider` with a passthrough component that captures the `adapter` prop into a module-scoped variable. Then assert against the captured adapter directly. Example:

  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render } from '@testing-library/react';
  import type { DiffFile, ReviewAdapter } from '@self-review/types';
  import type { ReviewAdapter as LocalReviewAdapter } from './adapter';

  let capturedAdapter: LocalReviewAdapter | null = null;

  vi.mock('./context/ReviewAdapterContext', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./context/ReviewAdapterContext')>();
    return {
      ...actual,
      ReviewAdapterProvider: ({ adapter, children }: { adapter: LocalReviewAdapter; children: React.ReactNode }) => {
        capturedAdapter = adapter;
        return <>{children}</>;
      },
    };
  });

  // (Optional) mock the heavy children (FileSection, providers, etc.) if rendering errors occur in jsdom.
  // Prefer leaving them un-mocked; only mock if necessary.

  import { SingleFileReview } from './SingleFileReview';

  const file: DiffFile = {
    oldPath: 'src/foo.ts',
    newPath: 'src/foo.ts',
    changeType: 'modified',
    isBinary: false,
    hunks: [],
  };

  beforeEach(() => { capturedAdapter = null; });
  ```

- The `expandContext` assertion should pass an `ExpandContextRequest` like `{ filePath: 'src/foo.ts', contextLines: 5 }` and assert the stub was called with the same payload, returning a value the test then checks.

- The `loadDiff` ignore-test should call `await capturedAdapter!.loadDiff()` and check the returned `files[0]` is the same file reference passed in via the prop (`expect(result.files[0]).toBe(file)`).

- The no-adapter test should assert `capturedAdapter!.expandContext` is `undefined` and `typeof capturedAdapter!.loadDiff === 'function'`.

## Input Dependencies

- Task 1 must be merged first — the new `adapter` prop and the merged-adapter `useMemo` are required for this test to compile and pass.

## Output Artifacts

- New file: `packages/react/src/SingleFileReview.test.tsx`.

## Implementation Notes

<details>

### Meaningful Test Strategy Guidelines

Your critical mantra for test generation is: "write a few tests, mostly integration".

This task adds three small assertions, all targeting the *custom logic* introduced in Task 1: the spread/merge order, the ignore-`loadDiff` rule, and the no-prop default. These are exactly the kind of tests the project wants — they cover the contract in the plan's "Success Criteria" without re-testing React, the provider, or the diff renderer.

Do **not**:

- Add a test that re-renders the entire diff and clicks the "Show N hidden lines" affordance. That tests the existing `useExpandContext` plumbing, which is already covered by `useExpandContext.test.ts`. The unit test in this task asserts the wiring, not the click handler.
- Add separate test files per assertion. Keep the three `it(...)` blocks in one `describe('SingleFileReview adapter merge', ...)`.
- Mock React, the providers, or types beyond what is strictly needed to capture the merged adapter.

### Step-by-step

1. Read `packages/react/src/SingleFileReview.tsx` after Task 1 lands so you know the exact prop signature and merge order.
2. Read `packages/react/src/components/DiffViewer/useExpandContext.test.ts` for the existing Vitest + React Testing Library style — match it.
3. Create `packages/react/src/SingleFileReview.test.tsx` using the Approach B scaffold above.
4. Write three tests:
   - `it('invokes consumer-supplied expandContext via the provider', async () => { ... })` — supply a `vi.fn()` stub returning `{ hunks: [], totalLines: 0 }`, render, then `await capturedAdapter!.expandContext!({ filePath: 'src/foo.ts', contextLines: 5 })` and assert the stub was called with that exact request.
   - `it('ignores consumer-supplied loadDiff in favor of the internal one', async () => { ... })` — supply `loadDiff: vi.fn().mockResolvedValue({ files: [], source: undefined })`, render, then `await capturedAdapter!.loadDiff()` and assert the result's `files[0]` is the prop file and that the stub was NOT called.
   - `it('exposes only loadDiff when no adapter prop is supplied', () => { ... })` — render without `adapter`, assert `capturedAdapter!.expandContext === undefined`, `typeof capturedAdapter!.loadDiff === 'function'`.
5. Run `npx vitest run packages/react/src/SingleFileReview.test.tsx` and iterate until green.
6. Run `npm run test:unit:renderer` from the workspace root to verify no regressions in the broader renderer suite.

### If Approach B's mock causes jsdom render errors

Some downstream providers may complain when rendered without their expected setup. If `render(<SingleFileReview file={file} />)` throws inside jsdom because of `ConfigProvider` / `DiffNavigationProvider` / `FileSection`, the simplest mitigation is to also mock `FileSection` to a no-op:

```ts
vi.mock('./components/DiffViewer/FileSection', () => ({
  default: () => null,
}));
```

Add that mock only if needed. Do not preemptively mock the providers — the goal is to exercise the real `useMemo` and the real `ReviewAdapterProvider` call site, just with a passthrough provider implementation.

### Cleanup

- Reset `capturedAdapter = null` in `beforeEach`.
- No snapshot files. No fixtures beyond the inline `DiffFile`.

</details>
