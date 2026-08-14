---
id: 5
group: "large-payload-guard"
dependencies: [2, 3, 4]
status: "completed"
created: "2026-03-04"
skills:
  - documentation
---
# Documentation Updates

## Objective
Update all project documentation to reflect the new large payload guard feature, including
configuration options, architecture changes, and IPC additions.

## Skills Required
- documentation: Technical writing for developer and user-facing docs

## Acceptance Criteria
- [ ] `README.md` option reference includes `max-files` (default 500) and `max-total-lines` (default 100000) with descriptions
- [ ] `docs/PRD.md` config examples updated with dual-threshold guard behavior
- [ ] `AGENTS.md` IPC channel table includes `diff:load-file` with direction, payload, and purpose
- [ ] `AGENTS.md` architecture section mentions large-payload mode and lazy loading flow
- [ ] `AGENTS.md` mentions `PayloadStats` in shared types section
- [ ] All documentation is accurate and consistent with the implemented behavior

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Match existing documentation style and formatting conventions
- Include both YAML config key names (kebab-case) and their descriptions
- Document that `0` disables a guard dimension
- Document that Cancel exits the app and Continue enters large-payload mode

## Input Dependencies
- Task 02: Guard behavior and config keys (must be implemented to document accurately)
- Task 03: Collapse-by-default behavior
- Task 04: Lazy content loading IPC and renderer behavior

## Output Artifacts
- Updated `README.md`
- Updated `docs/PRD.md`
- Updated `AGENTS.md`
