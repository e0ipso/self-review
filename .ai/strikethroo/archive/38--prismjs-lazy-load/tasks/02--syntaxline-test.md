---
id: 2
group: "prismjs-lazy-load"
dependencies: [1]
status: "completed"
created: 2026-03-11
skills:
  - jest
---
# Add SyntaxLine.test.tsx — Import-Without-Mock Verification

## Objective
Create `SyntaxLine.test.tsx` that imports `SyntaxLine` directly — with no `vi.mock('prismjs')` or `vi.mock('@self-review/react')` — and verifies that the component renders without error. This makes success criterion 2 machine-checkable and guards against regression to static Prism imports.

## Skills Required
- **jest**: Vitest (jest-compatible API), React Testing Library, jsdom environment

## Acceptance Criteria
- [ ] `SyntaxLine.test.tsx` exists at `packages/react/src/components/DiffViewer/SyntaxLine.test.tsx`
- [ ] The test file contains no `vi.mock('prismjs')` or `vi.mock('@self-review/react')` calls
- [ ] A test renders `<SyntaxLine>` with a simple content string and a known language (e.g. `typescript`)
- [ ] The test asserts the rendered `<code>` element is present and contains the content string
- [ ] The test passes under `npm run test:unit:renderer` without prismjs-related errors
- [ ] All previously passing tests in `packages/react` continue to pass

## Technical Requirements
- File location: `packages/react/src/components/DiffViewer/SyntaxLine.test.tsx`
- Test runner: Vitest with jsdom environment (matches existing renderer test config)
- Import the component under test directly: `import { SyntaxLine } from './SyntaxLine'` (or however it is exported — check the actual export)
- Use `@testing-library/react` `render` and `screen` (already used in other renderer tests)
- Wrap render in `act` if needed to satisfy React testing warnings, but do not call `await act(async () => ...)` just to trigger Prism loading — the test goal is the plain initial render
- The test observes the plain-escaped initial render (no `useEffect` firing in a pure render pass is fine and expected)

### Meaningful Test Strategy Guidelines

**Your critical mantra**: "write a few tests, mostly integration"

**What to test here:**
- Custom logic: the module can be imported without crashing (the primary regression guard)
- Critical path: component renders and produces output containing the input content
- Edge case: rendering with `language` set to an unrecognised/empty value should not crash

**What NOT to test:**
- Whether Prism actually highlights (that's Prism's own test suite)
- Whether `useEffect` fires and updates state (framework behaviour)
- Exhaustive prop permutations

## Input Dependencies
- Task 01 must be complete: `SyntaxLine.tsx` must have no static Prism imports before this test can pass without a mock

## Output Artifacts
- New file: `packages/react/src/components/DiffViewer/SyntaxLine.test.tsx`

## Implementation Notes

<details>
<summary>Step-by-step implementation guide</summary>

### 1. Check existing test infrastructure
Read an existing renderer test (e.g. `packages/react/src/components/DiffViewer/DiffViewer.test.tsx` or similar) to confirm:
- How Vitest/jsdom is configured (look for `@vitest/environment` annotation or vitest config)
- Which import paths are used for `render`, `screen`, `act`
- Whether any global test setup provides React context providers needed by `SyntaxLine`

### 2. Identify the SyntaxLine export
Check `SyntaxLine.tsx` (post-Task-01) for the export style — named export or default export — and import accordingly.

### 3. Write the test file
```tsx
// packages/react/src/components/DiffViewer/SyntaxLine.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SyntaxLine } from './SyntaxLine'; // adjust if default export

describe('SyntaxLine', () => {
  it('renders without crashing and without vi.mock for prismjs', () => {
    // No vi.mock('prismjs') — this is the regression guard
    render(<SyntaxLine content="const x = 1;" language="typescript" /* ...required props */ />);
    // The initial render shows plain-escaped content (Prism hasn't loaded yet in jsdom)
    expect(screen.getByRole('code')).toBeTruthy(); // or getByText if role isn't code
  });

  it('renders content in output when language is unrecognised', () => {
    render(<SyntaxLine content="hello world" language="unknown-lang" /* ...required props */ />);
    expect(screen.getByText(/hello world/)).toBeTruthy();
  });
});
```

> **Adapt props to match SyntaxLine's actual interface.** Open `SyntaxLine.tsx` and check what props are required (e.g. `lineNumber`, `type`, `isHighlighted`, etc.). Pass minimal valid values.

### 4. Handle context providers if needed
If `SyntaxLine` reads from a React context (e.g. theme or config), wrap the render call:
```tsx
render(
  <SomeProvider>
    <SyntaxLine ... />
  </SomeProvider>
);
```
Check the component source and any existing test wrappers for guidance. Do not mock the providers — use the real ones with minimal config.

### 5. Run the tests
```bash
npm run test:unit:renderer
```
Confirm:
- The new `SyntaxLine.test.tsx` passes
- No prismjs-related import error appears
- All previously passing tests still pass

</details>
