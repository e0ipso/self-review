---
id: 3
group: "version-check"
dependencies: [1, 2]
status: "completed"
created: "2026-02-27"
skills:
  - jest
  - documentation
---
# Write unit tests for version checker and update documentation

## Objective
Add unit tests for the version checker's core logic (semver comparison, API response handling) and update AGENTS.md to document the new feature.

## Skills Required
- Vitest (unit testing, mocking Electron's `net` module)
- Documentation (AGENTS.md updates)

## Acceptance Criteria
- [ ] New file `src/main/version-checker.test.ts` with unit tests
- [ ] Tests cover: `compareVersions` returns true when latest > current, false when equal or older
- [ ] Tests cover: `checkForUpdate` sends IPC when update available (mock `net.request` and `BrowserWindow`)
- [ ] Tests cover: `checkForUpdate` silently resolves on network error, timeout, non-200 response, and invalid JSON
- [ ] Tests cover: leading `v` is stripped from `tag_name`
- [ ] `AGENTS.md` updated: "No network access" convention amended with version check exception
- [ ] `AGENTS.md` updated: `version-checker.ts` added to project structure
- [ ] `AGENTS.md` updated: new IPC channels added to the IPC channel table

Use your internal Todo tool to track these and keep on track.

### Meaningful Test Strategy Guidelines

Your critical mantra for test generation is: "write a few tests, mostly integration".

**Focus on testing:**
- The `compareVersions` function — this is custom business logic
- The `checkForUpdate` integration behavior — that it sends IPC on update, stays silent on error

**Do NOT test:**
- Electron's `net.request` behavior itself
- IPC transport mechanics
- The UpdateBanner React component (trivial UI state)

## Technical Requirements
- Use Vitest (project uses `vitest.config.main.ts` for main process tests)
- Mock `electron` module (`net.request`, `BrowserWindow`)
- Export `compareVersions` from `version-checker.ts` so it can be tested directly (or test via the public `checkForUpdate` function)
- Colocate test file: `src/main/version-checker.test.ts`

## Input Dependencies
- Task 1: `src/main/version-checker.ts` with the implementation
- Task 2: completed UI integration

## Output Artifacts
- `src/main/version-checker.test.ts` — unit tests
- Updated `AGENTS.md` — documentation

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### 1. Export `compareVersions` for testability

In `src/main/version-checker.ts`, change `compareVersions` from a private function to a named export:
```typescript
export function compareVersions(current: string, latest: string): boolean {
```

### 2. Create `src/main/version-checker.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { compareVersions } from './version-checker';

describe('compareVersions', () => {
  it('returns true when latest is newer (patch)', () => {
    expect(compareVersions('1.17.1', '1.17.2')).toBe(true);
  });

  it('returns true when latest is newer (minor)', () => {
    expect(compareVersions('1.17.1', '1.18.0')).toBe(true);
  });

  it('returns true when latest is newer (major)', () => {
    expect(compareVersions('1.17.1', '2.0.0')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(compareVersions('1.17.1', '1.17.1')).toBe(false);
  });

  it('returns false when current is newer', () => {
    expect(compareVersions('2.0.0', '1.17.1')).toBe(false);
  });

  it('handles versions with missing patch', () => {
    expect(compareVersions('1.17', '1.17.1')).toBe(true);
  });
});
```

For the `checkForUpdate` integration test, mock `net.request` to return a fake response with a `tag_name` and verify that `mainWindow.webContents.send` is called with the right channel and payload. Also test the error paths (network error, timeout, bad JSON) and verify `send` is never called.

### 3. Update `AGENTS.md`

**a) Amend the "No network access" bullet** in the Critical Conventions section. Change:
```
- **No network access.** The app makes zero network requests. No telemetry, no analytics, no CDN fetches. All assets are bundled.
```
to:
```
- **No network access (except version check).** The app makes zero network requests at runtime, with one exception: on startup, it makes a single non-blocking request to the GitHub Releases API (`api.github.com`) to check for updates. This request is fire-and-forget — if it fails for any reason (offline, timeout, firewall), it is silently ignored. No telemetry, no analytics, no CDN fetches. All assets are bundled.
```

**b) Add `version-checker.ts`** to the project structure tree under `src/main/`:
```
│   ├── version-checker.ts   # Checks GitHub Releases API for updates (startup only)
```

**c) Add new IPC channels** to the IPC channel table:
```
| `version-update:available` | Main → Renderer | `VersionUpdateInfo` | Notify renderer of available update |
| `open-external`            | Renderer → Main | `string` (URL)      | Open URL in default browser         |
```

</details>
