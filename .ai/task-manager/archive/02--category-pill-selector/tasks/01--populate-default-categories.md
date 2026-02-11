---
id: 1
group: "config-defaults"
dependencies: []
status: "completed"
created: "2026-02-11"
skills:
  - typescript
---
# Populate Default Categories in Config Defaults

## Objective
Add the five PRD-defined default categories (bug, security, style, question, nit) to the built-in defaults in both `src/main/config.ts` and `src/renderer/context/ConfigContext.tsx`, so the app ships useful categories out-of-the-box without requiring a YAML config file.

## Skills Required
- TypeScript: Modifying default configuration objects

## Acceptance Criteria
- [ ] `config.ts` defaults include 5 categories with correct name, description, and color values from the plan
- [ ] `ConfigContext.tsx` defaults include the same 5 categories (identical data)
- [ ] Existing `mergeConfig` array-replace behavior is unaffected (user YAML `categories: []` still results in no categories)
- [ ] App compiles without errors

## Technical Requirements
- The `CategoryDef` type in `src/shared/types.ts` already defines `{ name: string; description: string; color: string }` — no type changes needed
- Both files already have `categories: []` in their defaults — replace with the populated array

## Input Dependencies
None — this task has no dependencies.

## Output Artifacts
- Modified `src/main/config.ts` with populated `categories` array in `defaults`
- Modified `src/renderer/context/ConfigContext.tsx` with populated `categories` array in `defaultConfig`

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### Step 1: Update `src/main/config.ts`

Replace `categories: [],` (line 17) in the `defaults` object with:

```typescript
categories: [
  { name: 'bug', description: 'Likely defect or incorrect behavior', color: '#e53e3e' },
  { name: 'security', description: 'Security vulnerability or concern', color: '#dd6b20' },
  { name: 'style', description: 'Code style, naming, or formatting issue', color: '#3182ce' },
  { name: 'question', description: 'Clarification needed — not necessarily a problem', color: '#805ad5' },
  { name: 'nit', description: 'Minor nitpick, low priority', color: '#718096' },
],
```

### Step 2: Update `src/renderer/context/ConfigContext.tsx`

Replace `categories: [],` (line 11) in the `defaultConfig` object with the identical array:

```typescript
categories: [
  { name: 'bug', description: 'Likely defect or incorrect behavior', color: '#e53e3e' },
  { name: 'security', description: 'Security vulnerability or concern', color: '#dd6b20' },
  { name: 'style', description: 'Code style, naming, or formatting issue', color: '#3182ce' },
  { name: 'question', description: 'Clarification needed — not necessarily a problem', color: '#805ad5' },
  { name: 'nit', description: 'Minor nitpick, low priority', color: '#718096' },
],
```

### Important Notes
- The `mergeConfig` function in `config.ts` already uses array-replace for `categories` — if a user's YAML specifies `categories:` (even as `[]`), it will override these defaults entirely. This is the intended behavior per the plan.
- Both files must have **identical** category data to ensure consistency whether the config comes from main process IPC or from the renderer fallback.

</details>
