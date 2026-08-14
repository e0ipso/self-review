---
id: 2
group: "fix-portal-container-null-first-render"
dependencies: [1]
status: "completed"
created: 2026-03-14
skills:
  - typescript
---
# Update AGENTS.md Portal Container Documentation

## Objective

Update the "Radix/Base UI portal containers" section in `packages/react/AGENTS.md` to replace the
null-on-first-render caveat with accurate documentation of the callback ref behavior.

## Skills Required

- Documentation editing

## Acceptance Criteria

- [ ] The sentence "The `portalContainer` is `null` on the first render (portals fall back to `document.body`) and is set to the wrapper div after mount via `useEffect`." is removed
- [ ] Replacement text accurately describes that `portalContainer` is set synchronously via a callback ref during React's commit phase and is available before the first browser paint
- [ ] The rest of the section (describing the `container` prop usage and the five consuming components) remains intact

## Technical Requirements

- File: `packages/react/AGENTS.md`
- Section: "Radix/Base UI portal containers"

## Input Dependencies

- Task 01 completed: the callback ref is implemented and the behavior is confirmed

## Output Artifacts

- Modified `packages/react/AGENTS.md` with updated portal container documentation

## Implementation Notes

<details>
<summary>Exact change guidance</summary>

**Current text to replace (lines 92-93):**

```
The `portalContainer` is `null` on the first render (portals fall back to `document.body`) and
is set to the wrapper div after mount via `useEffect`.
```

**Replacement text:**

```
`portalContainer` is set synchronously via a callback ref during React's commit phase — before
effects and before the browser paints. Portals always render inside the scoped subtree from the
first render onwards; there is no null-on-first-render window.
```

</details>
