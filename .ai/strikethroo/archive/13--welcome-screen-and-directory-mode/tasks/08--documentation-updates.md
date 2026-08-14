---
id: 8
group: "documentation"
dependencies: [1, 3, 4, 5, 6, 7]
status: "completed"
created: "2026-02-16"
skills:
  - technical-writing
---

# Update PRD.md and AGENTS.md Documentation

## Objective

Document the new welcome screen behavior, directory review mode, and app launcher support in `docs/PRD.md` and add a concise mention in `AGENTS.md`.

## Skills Required

- Technical writing

## Acceptance Criteria

- [ ] `docs/PRD.md` Section 4 (CLI Interface): Documents positional path argument for non-git directories
- [ ] `docs/PRD.md` new Section 4.6 (App Launcher Behavior): Documents behavior when launched from macOS Finder / Linux app launchers
- [ ] `docs/PRD.md` Section 5.3.0 (or equivalent empty diff section): Adds directory mode variant
- [ ] `docs/PRD.md` new Section 5.7 (Welcome Screen): Documents welcome screen layout, mode selection, directory picker flow
- [ ] `docs/PRD.md` Section 9 (Git Integration): Adds subsection on directory mode as alternative
- [ ] `docs/PRD.md` Section 10.3 (Error Handling): Updates "not a git repository" to describe new fallback behavior
- [ ] `AGENTS.md` has one concise sentence noting support for directory-based review mode and welcome-screen fallback
- [ ] Documentation accurately reflects the implemented behavior
- [ ] No excessive detail or feature speculation — document what exists

## Technical Requirements

- Match existing PRD.md writing style and section numbering
- AGENTS.md change should be minimal — one sentence in the overview

## Input Dependencies

- All implementation tasks (1-7) should be complete so documentation reflects actual behavior

## Output Artifacts

- Updated `docs/PRD.md`
- Updated `AGENTS.md`

## Implementation Notes

<details>

1. **Read `docs/PRD.md`** to understand existing structure, section numbering, and writing style.

2. **Section 4 (CLI Interface)**: Add documentation that when a positional path argument is provided and the current directory is not a git repo, the path is treated as a directory to review (all files as new additions).

3. **New Section 4.6 (App Launcher Behavior)**:
   - Explain that when launched from macOS Finder or Linux app launchers, `process.cwd()` may not be a git repo
   - The app shows a welcome screen with a directory picker instead of exiting
   - The `-psn_XXXX` argument from macOS Finder is automatically filtered

4. **Section 5.3.0 / Empty Diff Help**: Add variant text for directory mode ("No files found in the selected directory").

5. **New Section 5.7 (Welcome Screen)**:
   - Layout: centered Card with directory picker button
   - Mode explanation text (git vs directory)
   - Flow: user clicks Browse → native dialog → directory selected → review UI loads

6. **Section 9 (Git Integration)**: Add subsection explaining directory mode as an alternative when git is unavailable. Explain that files are treated as all-new additions.

7. **Section 10.3 (Error Handling)**: Change "not a git repository → exit code 1" to describe the new fallback to welcome screen.

8. **Update `AGENTS.md`**: Add one sentence to the overview paragraph, e.g., "Supports directory-based review mode (all files as new) with a welcome-screen fallback when launched without git context."

9. **Do NOT add verbose feature descriptions or expand the architecture section** in AGENTS.md — keep it to one concise sentence as specified in the plan.

</details>
