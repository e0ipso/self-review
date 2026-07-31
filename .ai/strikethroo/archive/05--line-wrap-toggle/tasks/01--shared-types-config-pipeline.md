---
id: 1
group: 'line-wrap-config'
dependencies: []
status: 'completed'
created: '2026-02-12'
skills:
  - typescript
---

# Add wordWrap to Shared Types, Config Pipeline, and Unit Tests

## Objective

Extend the `AppConfig` data contract with a `wordWrap: boolean` field and wire it through the
entire configuration pipeline: shared types, main-process config loader (with YAML `word-wrap`
parsing), renderer-side ConfigContext defaults, and unit test coverage.

## Skills Required

- TypeScript (type definitions, config parsing logic, Vitest unit tests)

## Acceptance Criteria

- [ ] `AppConfig` in `src/shared/types.ts` includes `wordWrap: boolean`
- [ ] `src/main/config.ts` defaults `wordWrap` to `true`
- [ ] `loadYamlConfig` parses `word-wrap` (kebab-case) as a boolean, falling back on invalid value
- [ ] `src/renderer/context/ConfigContext.tsx` default config includes `wordWrap: true`
- [ ] `src/main/config.test.ts` has tests for `word-wrap` parsing (valid boolean, non-boolean ignored, default value)
- [ ] All existing unit tests still pass

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Follow the exact same pattern as `showUntracked` / `show-untracked` for YAML parsing
- The YAML key is `word-wrap` (kebab-case), the TypeScript field is `wordWrap` (camelCase)
- Boolean type check: `typeof raw['word-wrap'] === 'boolean'`
- Default value: `true` (lines wrap by default)

## Input Dependencies

None — this is the foundation task.

## Output Artifacts

- Updated `AppConfig` type with `wordWrap: boolean` (consumed by all other tasks)
- Config pipeline that correctly loads `word-wrap` from YAML files
- Unit tests verifying config parsing behavior

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### 1. `src/shared/types.ts` — Add `wordWrap` to `AppConfig`

Add `wordWrap: boolean` to the `AppConfig` interface, after `showUntracked`:

```typescript
export interface AppConfig {
  theme: 'light' | 'dark' | 'system';
  diffView: 'split' | 'unified';
  fontSize: number;
  outputFormat: string;
  ignore: string[];
  categories: CategoryDef[];
  defaultDiffArgs: string;
  showUntracked: boolean;
  wordWrap: boolean;  // <-- ADD THIS
}
```

### 2. `src/main/config.ts` — Add default and YAML parsing

In the `defaults` object, add:
```typescript
wordWrap: true,
```

In `loadYamlConfig`, add parsing after the `show-untracked` block, following the exact same pattern:
```typescript
if ('word-wrap' in raw && typeof raw['word-wrap'] === 'boolean') {
  config.wordWrap = raw['word-wrap'];
}
```

### 3. `src/renderer/context/ConfigContext.tsx` — Mirror the default

In the `defaultConfig` object, add:
```typescript
wordWrap: true,
```

### 4. `src/main/config.test.ts` — Add unit tests

Add the following test cases inside the `describe('loadConfig', ...)` block:

1. **Default value test**: Verify `loadConfig()` returns `wordWrap: true` when no config files exist (can be added as assertion to the existing "returns default config" test).

2. **Parses word-wrap from YAML**:
```typescript
it('loads word-wrap from config', () => {
  const mockYaml = `word-wrap: false`;
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);
  const config = loadConfig();
  expect(config.wordWrap).toBe(false);
});
```

3. **Ignores non-boolean word-wrap**:
```typescript
it('ignores non-boolean word-wrap values', () => {
  const mockYaml = `word-wrap: "yes"`;
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);
  const config = loadConfig();
  expect(config.wordWrap).toBe(true); // Falls back to default
});
```

</details>
