---
id: 2
group: 'package-config'
dependencies: []
status: 'completed'
created: '2026-02-12'
skills:
  - bash
---

# Update Husky Hooks for Fast Local Development

## Objective

Reconfigure the Husky git hooks to run only fast checks (lint + unit tests) locally, delegating the slow E2E test suite to CI.

## Skills Required

- bash: Shell scripting for git hook files

## Acceptance Criteria

- [ ] `.husky/pre-commit` runs `npm run lint && npm run test:unit` (lint first, then unit tests)
- [ ] `.husky/pre-push` runs `npm run test:unit` (unit tests only)
- [ ] Both files contain only the single command line (no shebang, no comments — matching Husky v9 convention)
- [ ] Local pre-commit completes in under 30 seconds (lint + unit tests)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `.husky/pre-commit` currently contains: `npm test:unit` (note: this is missing the `run` keyword and only runs unit tests, not lint)
- `.husky/pre-push` currently contains: `npm run test` (runs unit + e2e — too slow)
- Husky v9 hook files are plain shell scripts with just the command(s) to run — no `#!/bin/sh` header needed

## Input Dependencies

None — this is a standalone configuration task.

## Output Artifacts

- Modified `.husky/pre-commit` with lint + unit test commands
- Modified `.husky/pre-push` with unit test command only

## Implementation Notes

<details>

### .husky/pre-commit

Replace the entire file content with:
```
npm run lint && npm run test:unit
```

This chains lint (fast, ~5s) before unit tests (~10-15s). The `&&` ensures unit tests only run if lint passes. Total expected time: <30s.

**Note:** The current file has `npm test:unit` which is actually malformed (missing `run`). The plan specifies `npm run lint && npm run test:unit` as the replacement.

### .husky/pre-push

Replace the entire file content with:
```
npm run test:unit
```

This runs only unit tests before push. The full E2E suite (which requires packaging the Electron app) is delegated to CI. This reduces push-time gating from ~2-3 minutes to ~10-15 seconds.

Both files should end with a newline character.

</details>
