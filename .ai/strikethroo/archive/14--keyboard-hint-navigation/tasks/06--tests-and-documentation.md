---
id: 6
group: 'quality'
dependencies: [5]
status: 'completed'
created: '2026-02-16'
skills:
  - unit-testing
  - typescript
---

# Write Tests and Update Documentation

## Objective

Add meaningful unit tests for the keyboard navigation system's core logic and update project documentation to reference the new shortcuts.

## Skills Required

Vitest unit testing, TypeScript, documentation.

## Acceptance Criteria

- [ ] Unit tests for label generation algorithm (single-char, two-char, edge cases)
- [ ] Unit tests for text input focus guard (input, textarea, contenteditable, MDEditor)
- [ ] Unit tests for mode state transitions (normal → hint-diff → normal, normal → hint-file → normal, escape dismissal)
- [ ] Unit tests for hint matching logic (exact match, partial match, no match)
- [ ] `AGENTS.md` updated with keyboard shortcuts documentation
- [ ] `docs/PRD.md` section 10.2 updated to reference keyboard navigation

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

### Meaningful Test Strategy Guidelines

Your critical mantra for test generation is: "write a few tests, mostly integration".

**When TO Write Tests:**
- Custom business logic: label generation algorithm, input buffer matching
- Critical user workflows: mode transitions, hint activation
- Edge cases: empty target sets, very large target sets requiring two-char labels

**When NOT to Write Tests:**
- React portal rendering (framework feature)
- scrollBy/scrollIntoView behavior (browser API)
- DOM event dispatch/listening mechanics (browser API)
- Component rendering (covered by e2e tests if added later)

### Test File Location

- `src/renderer/hooks/useKeyboardNavigation.test.ts` — colocated with the hook
- Extract pure functions (label generation, input guard, hint matching) into testable utilities if they aren't already

### Documentation Updates

- `AGENTS.md`: Add a "Keyboard Shortcuts" subsection under the existing structure documenting `f`, `g`, `j/k`, `Escape` and the `useKeyboardNavigation` hook
- `docs/PRD.md`: Update section 10.2 (Accessibility) to mention keyboard-driven navigation

## Input Dependencies

- Task 5: Fully integrated keyboard navigation system

## Output Artifacts

- Test file(s) with passing unit tests
- Updated `AGENTS.md` and `docs/PRD.md`

## Implementation Notes

<details>

### Extracting Testable Logic

The `useKeyboardNavigation` hook likely contains pure functions that can be extracted and tested independently:

1. **`generateLabels(count: number): string[]`** — Extract if not already standalone
2. **`isTextInputFocused(): boolean`** — Harder to unit test (depends on DOM), but can test with JSDOM
3. **Hint matching logic** — The buffer matching can be extracted

### Label Generation Tests

```typescript
describe('generateLabels', () => {
  it('returns single characters for small counts', () => {
    const labels = generateLabels(3);
    expect(labels).toEqual(['a', 's', 'd']);
  });

  it('returns all single chars for count equal to charset length', () => {
    const labels = generateLabels(18); // asdfjklhgqwertuiop
    expect(labels).toHaveLength(18);
    expect(new Set(labels).size).toBe(18); // all unique
  });

  it('returns two-char combos when count exceeds charset', () => {
    const labels = generateLabels(20);
    expect(labels).toHaveLength(20);
    expect(labels[18]).toBe('aa'); // first two-char combo
    expect(labels[19]).toBe('as');
  });

  it('returns empty array for zero count', () => {
    expect(generateLabels(0)).toEqual([]);
  });
});
```

### Text Input Guard Tests

Use JSDOM to set `document.activeElement` and verify:
- Returns `true` for `<input>`, `<textarea>`, `[contenteditable="true"]`
- Returns `true` when focused element is inside an MDEditor (`[class*="md-editor"]`)
- Returns `false` for regular divs, buttons, body

### Mode Transition Tests

Use `renderHook` from `@testing-library/react` to test the hook's state machine:
- Starting mode is `'normal'`
- Dispatching 'f' keydown transitions to `'hint-diff'`
- Dispatching 'Escape' in hint mode transitions back to `'normal'`
- Dispatching 'g' keydown transitions to `'hint-file'`

### Documentation

For AGENTS.md, add after the "Component Structure" or similar section:

```markdown
### Keyboard Shortcuts

The app supports Vimium-style keyboard navigation:

- `f` — Activate hint labels on changed diff lines to open a comment input
- `g` — Activate hint labels on file tree entries to jump to a file
- `j` / `k` — Smooth scroll the diff pane down/up
- `Escape` — Dismiss active hint overlay

All shortcuts are suppressed when a text input has focus. The implementation lives in `useKeyboardNavigation` hook with `HintOverlay` for rendering hint badges.
```

</details>
