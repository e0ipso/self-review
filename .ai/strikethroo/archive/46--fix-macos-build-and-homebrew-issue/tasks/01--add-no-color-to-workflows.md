---
id: 1
group: "ci-fix"
dependencies: []
status: "completed"
created: "2026-03-14"
skills:
  - github-actions
---
# Add NO_COLOR=1 to Release Workflows

## Objective
Add `NO_COLOR=1` as a workflow-level environment variable to both `.github/workflows/release-darwin.yml` and `.github/workflows/release.yml` to fix the colorette stack overflow on macOS and prevent the same issue on Linux.

## Skills Required
- github-actions

## Acceptance Criteria
- [ ] `release-darwin.yml` has `NO_COLOR: "1"` set at the workflow level (top-level `env` block)
- [ ] `release.yml` has `NO_COLOR: "1"` set at the workflow level (top-level `env` block)
- [ ] Both workflows remain syntactically valid YAML

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Add a top-level `env` block to each workflow file (after `concurrency`, before `jobs`)
- The `env` block should contain `NO_COLOR: "1"`
- This follows the no-color.org standard which colorette respects (line 33: `isDisabled = "NO_COLOR" in env`)
- The env var must be workflow-level (not step-level or job-level) so it applies to all steps

## Input Dependencies
None — these are existing workflow files.

## Output Artifacts
- Modified `.github/workflows/release-darwin.yml`
- Modified `.github/workflows/release.yml`

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### release-darwin.yml

Add the following block after the `concurrency` block (after line 18) and before `jobs:`:

```yaml
env:
  NO_COLOR: "1"
```

### release.yml

Add the following block after the `concurrency` block (after line 16) and before `jobs:`:

```yaml
env:
  NO_COLOR: "1"
```

### Why this works
- `colorette@2.0.20` checks for `NO_COLOR` in the environment (line 33 of `colorette/index.cjs`)
- When `NO_COLOR` is set, colorette uses identity functions instead of recursive `replaceClose()`
- This eliminates the stack overflow caused by large webpack output volume

### Verification
After the change, validate YAML syntax:
```bash
npx yaml-lint .github/workflows/release-darwin.yml
npx yaml-lint .github/workflows/release.yml
```
Or simply check that the files parse correctly with Node.js:
```bash
node -e "const yaml = require('js-yaml'); const fs = require('fs'); yaml.load(fs.readFileSync('.github/workflows/release-darwin.yml', 'utf8')); console.log('Valid')"
```

</details>
