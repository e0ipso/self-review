---
id: 3
group: "documentation"
dependencies: [1]
status: "completed"
created: "2026-03-03"
skills:
  - documentation
---
# Update documentation (PRD.md, AGENTS.md, README.md)

## Objective
Update all documentation to reflect the new default ignore patterns and gitignore-compatible format.

## Skills Required
- documentation

## Acceptance Criteria
- [ ] PRD.md Section 7.4 updated: `ignore` description mentions gitignore-compatible format, lists the default patterns
- [ ] README.md config table updated: `ignore` description mentions gitignore format and that defaults exist
- [ ] AGENTS.md updated if any relevant sections reference the ignore config
- [ ] Documentation matches the actual implementation (default values, behavior)

## Technical Requirements
- Follow existing documentation style in each file (terse, factual)
- Do not restructure or reformat unrelated sections

## Input Dependencies
- Task 1: Final list of default ignore patterns from `config.ts`

## Output Artifacts
- Modified `docs/PRD.md`
- Modified `README.md`
- Modified `AGENTS.md` (if needed)

## Implementation Notes

<details>

### PRD.md (Section 7.4)

Find the ignore configuration example around line 536. Update the description from "File patterns to ignore (glob syntax)" to "File patterns to ignore (gitignore-compatible syntax)". Add a note about defaults:

```yaml
# File patterns to ignore (gitignore-compatible syntax).
# Defaults include common vendor/build directories: .git, node_modules, vendor,
# __pycache__, dist, build, lock files, etc.
# Set to empty array to disable defaults: ignore: []
ignore:
  - "package-lock.json"
  - "*.generated.ts"
```

### README.md

Find the `ignore` line around line 169. Update:
```
- `ignore`: file patterns to exclude (gitignore-compatible syntax; defaults to common vendor/build directories)
```

### AGENTS.md

Search for any mentions of `ignore` config. If present, add a note about defaults. The AGENTS.md is already concise — keep any additions minimal.

</details>
