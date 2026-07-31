---
id: 2
group: "testing"
dependencies: [1]
status: "completed"
created: "2026-05-03"
skills:
  - "vitest"
  - "react-components"
---
# Add Unit Test for FileTree Split/Unified Toggle (Standalone Embedding Contract)

## Objective

Add a Vitest + `@testing-library/react` test for `FileTree` that proves the relocated Split/Unified toggle works when `FileTree` is rendered **standalone** (without `Toolbar`) inside a `ConfigProvider`. This test protects the embedding contract: hosts of `@self-review/react` that mount only `FileTree` + `DiffViewer` must still get a working diff-view selector.

This is the **only** new test introduced by the plan — it covers business logic specific to this relocation (the toggle must dispatch `updateConfig({ diffView })` to the shared config context, not depend on the toolbar). Per the "few tests, mostly integration" mantra, no separate unit task is created for the toolbar-removal side because there was no existing toolbar-side unit test.

## Skills Required

- `vitest`: Test runner setup, `describe`/`it`/`expect`, mock functions (`vi.fn()`), assertion API.
- `react-components`: `@testing-library/react` rendering with provider wrappers, `screen.getByTestId`, `userEvent` interactions.

## Acceptance Criteria

- [ ] New file `packages/react/src/components/FileTree.test.tsx` exists.
- [ ] The test renders `<FileTree />` wrapped in the necessary providers (`ConfigProvider`, `ReviewProvider`, `DiffNavigationProvider`, `ReviewAdapterProvider` — whichever the existing `FileTree` requires) **without** rendering `Toolbar`.
- [ ] Assertion 1: Both `data-testid="view-mode-split"` and `data-testid="view-mode-unified"` are queryable in the rendered output.
- [ ] Assertion 2: The element with `data-testid="view-mode-split"` carries the active/pressed visual state when the initial `config.diffView` value is `'split'` (verify via `aria-pressed="true"` or the `data-state="on"` attribute that Radix `ToggleGroupItem` sets).
- [ ] Assertion 3: Clicking the `view-mode-unified` item invokes `updateConfig` with `{ diffView: 'unified' }` exactly once. Use a spy/mock injected through the provider, or assert via reading the resulting `config.diffView` from a probe component if `ConfigProvider` is hard to mock.
- [ ] `npm run test:unit:renderer` (or `npm run test:unit`) passes with the new test included.
- [ ] No changes to production source files (`FileTree.tsx`, `ConfigContext.tsx`, etc.) — the test must adapt to the existing API.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- **Test framework:** Vitest with the `jsdom` environment (the renderer config — see `AGENTS.md` "Unit Tests" section).
- **DOM testing:** `@testing-library/react` (`render`, `screen`) and `@testing-library/user-event` for the click interaction.
- **Providers:** Inspect `packages/react/src/context/ConfigContext.tsx`, `ReviewContext.tsx`, `DiffNavigationContext.tsx`, and `ReviewAdapterContext.tsx` to determine the minimum provider stack `FileTree` needs to render. Use real providers with seeded values where available, rather than mocking them out, so the test exercises the same code path as the embedded scenario.
- **Mocking strategy options** (pick whichever is simpler given the existing context API):
  1. **Spy on `updateConfig`**: Wrap `ConfigProvider` and pass a custom initial config + a spy. If `ConfigProvider` does not accept an `updateConfig` override prop, fall back to option 2.
  2. **Probe component**: Render a sibling `<ConfigProbe />` that reads `useConfig().config.diffView` and writes it to a `data-testid='probe-diff-view'` div. Assert the probe value flips from `'split'` to `'unified'` after clicking the toggle.

## Input Dependencies

- **Task 1** must be completed first — the toggle and `useConfig` wiring must already live in `FileTree.tsx`. Without task 1, this test would assert against absent markup.

## Output Artifacts

- `packages/react/src/components/FileTree.test.tsx` — new test file containing the `FileTree` toggle assertions described above.

## Implementation Notes

<details>

### Meaningful Test Strategy Reminder

Per the "few tests, mostly integration" mantra:
- **DO** test that the toggle dispatches the right config update (custom integration of relocated component with shared context).
- **DO** test the standalone-embedding rendering (the *raison d'être* of the move).
- **DO NOT** test that `ToggleGroup` from shadcn/ui works correctly — that is upstream library behavior.
- **DO NOT** test the visual styling, tooltip text, or icon presence — those are framework concerns, and the assertions on `data-testid` cover the contract that downstream consumers rely on.

Keep the test file under ~80 lines. Three assertions max.

### Suggested Skeleton

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import FileTree from './FileTree';
// Import providers as needed — adjust paths to match the actual exports
import { ConfigProvider } from '../context/ConfigContext';
import { ReviewProvider } from '../context/ReviewContext';
// ... other providers

describe('FileTree view-mode toggle', () => {
  function renderStandalone(/* options */) {
    return render(
      <ConfigProvider /* seed config.diffView = 'split' */>
        <ReviewProvider /* seed empty diff or fixture */>
          {/* additional providers as required by FileTree */}
          <FileTree />
        </ReviewProvider>
      </ConfigProvider>
    );
  }

  it('renders both view-mode toggle items in the file tree header', () => {
    renderStandalone();
    expect(screen.getByTestId('view-mode-split')).toBeInTheDocument();
    expect(screen.getByTestId('view-mode-unified')).toBeInTheDocument();
  });

  it('marks the split item as active when config.diffView is "split"', () => {
    renderStandalone();
    expect(screen.getByTestId('view-mode-split')).toHaveAttribute('data-state', 'on');
  });

  it('dispatches updateConfig({ diffView: "unified" }) when the unified item is clicked', async () => {
    // Use an updateConfig spy or a probe component to observe the dispatch.
    renderStandalone();
    await userEvent.click(screen.getByTestId('view-mode-unified'));
    // ... assertion on the spy or probe
  });
});
```

### Inspecting Existing Providers Before Coding

Before writing the test:
1. `cat packages/react/src/context/ConfigContext.tsx` — confirm the `ConfigProvider` API (does it accept `initialConfig`? An override for `updateConfig`?).
2. `cat packages/react/src/context/ReviewContext.tsx` — confirm what `FileTree` reads (`diffFiles`, `files`, `toggleViewed`) and how to seed it.
3. `cat packages/react/src/context/DiffNavigationContext.tsx` and `ReviewAdapterContext.tsx` — confirm whether `FileTree` requires their providers.
4. Look for any existing test in `packages/react/src/components/*.test.tsx` to mirror the provider-wrapping pattern used elsewhere in the package. If a test utility/wrapper already exists (e.g., `renderWithProviders`), reuse it instead of building a new wrapper.

### Verification

- `npm run test:unit:renderer` (or `npm run test:unit` if the renderer config is unified with the main config in this repo).
- The new test file must produce 3 passing assertions. The pre-existing test suite must remain green (no regressions from task 1's changes).

### Gotchas

- Radix `ToggleGroupItem` typically renders as a `<button>` with `data-state="on"` / `data-state="off"`. If your `userEvent.click` does not toggle state, check whether a synthetic click event suffices or whether `fireEvent.pointerDown` is needed (Radix sometimes uses pointer events).
- If `ConfigProvider` resolves config asynchronously (e.g., reads from `electronAPI`), use a synchronous test-only seed; do not introduce mocks for `electronAPI` solely for this test — fall back to the probe-component approach.

</details>
