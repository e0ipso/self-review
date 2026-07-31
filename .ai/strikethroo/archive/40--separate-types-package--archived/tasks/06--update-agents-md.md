---
id: 6
group: types-package
dependencies:
  - 1
status: completed
created: '2026-03-11'
skills:
  - typescript
---
# Update AGENTS.md Documentation

## Objective
Update `AGENTS.md` to document the new `@self-review/types` package in the `packages/` section, and update any references that describe `@self-review/core` as the source of shared types.

## Skills Required
Technical writing.

## Acceptance Criteria
- [ ] The `packages/` section in `AGENTS.md` mentions `@self-review/types` with a brief description (zero-dependency shared types package)
- [ ] The description of `@self-review/react`'s dependency on `@self-review/core` is updated to reflect that it now depends on `@self-review/types` for types (core remains a devDep for runtime functions)
- [ ] No behavioral descriptions are changed — only additive structural documentation

## Technical Requirements
- Changes are additive only; no existing correct information is removed
- The `packages/` directory listing in AGENTS.md should now show three packages: `core`, `react`, `types`

## Input Dependencies
- Task 01: `packages/types/` package must exist to document accurately

## Output Artifacts
- Modified `AGENTS.md`

## Implementation Notes

<details>
<summary>What to update</summary>

### Project Structure section

In the `packages/` tree, add a new entry alongside `core` and `react`:
```
├── packages/
│   ├── core/                    # @self-review/core — headless diff parsing & review logic
│   ├── react/                   # @self-review/react — React components for review UI
│   └── types/                   # @self-review/types — shared TypeScript interfaces (zero runtime deps)
```

### Package description paragraph

Find the paragraph that reads:
> The workspace packages `@self-review/core` and `@self-review/react` expose shared logic and UI components.

Update to:
> The workspace packages `@self-review/core`, `@self-review/react`, and `@self-review/types` expose shared logic, UI components, and shared TypeScript interfaces respectively.

Also update any sentence explaining that the Electron app uses relative path imports — mention that it imports types from `packages/types/src/index`.

Keep all other content unchanged.

</details>
