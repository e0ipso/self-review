---
id: 3
group: 'validation'
dependencies: [1, 2]
status: 'completed'
created: '2026-02-17'
skills:
  - flatpak
---

# Validate with flatpak-builder-lint

## Objective

Run `flatpak-builder-lint` against the manifest and appstream metainfo to ensure all Flathub submission requirements are met. Fix any errors or warnings that arise.

## Skills Required

- `flatpak` — Running flatpak-builder-lint and interpreting results

## Acceptance Criteria

- [ ] `flatpak-builder-lint manifest flatpak/com.mateuaguilo.SelfReview.yml` passes with zero errors
- [ ] `flatpak-builder-lint appstream flatpak/com.mateuaguilo.SelfReview.metainfo.xml` passes with zero errors
- [ ] Any warnings are documented and addressed or justified

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `flatpak-builder-lint` must be installed (via `org.flatpak.Builder` Flatpak or pip)
- **IMPORTANT**: This task CANNOT run inside the dev container. It requires a host Linux system with Flatpak installed.
- If running inside a dev container, report this limitation and provide the exact commands for the user to run on the host.

## Input Dependencies

- Task 1: Updated manifest with extra-data architecture
- Task 2: Updated metainfo with screenshots

## Output Artifacts

- Lint validation results (pass/fail)
- Any fixes applied to manifest or metainfo

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### 1. Check environment

First check if we're in a dev container:
```bash
[ -f /.dockerenv ] && echo "IN CONTAINER" || echo "ON HOST"
```

If in container, output the commands for the user to run manually and skip execution.

### 2. Run manifest lint

```bash
flatpak-builder-lint manifest flatpak/com.mateuaguilo.SelfReview.yml
```

### 3. Run appstream lint

```bash
flatpak-builder-lint appstream flatpak/com.mateuaguilo.SelfReview.metainfo.xml
```

### 4. Fix any issues

If errors are found, fix them in the relevant files and re-run the linter until clean.

### 5. Document results

Record the lint output for the execution summary.

</details>
