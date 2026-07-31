---
id: 4
group: 'documentation'
dependencies: [1, 2, 3]
status: 'completed'
created: 2026-02-17
skills:
  - documentation
---

# Update Documentation

## Objective

Update project documentation to include Flatpak installation instructions and document the new `flatpak/` directory.

## Skills Required

- Technical documentation writing

## Acceptance Criteria

- [ ] `README.md` includes Flatpak/Flathub installation instructions
- [ ] `AGENTS.md` mentions the `flatpak/` directory and its purpose in the project structure
- [ ] Instructions include both `flatpak install` command and shell alias suggestion

## Technical Requirements

- Add a "Flatpak" section to the installation instructions in `README.md`
- Include: `flatpak install flathub com.mateuaguilo.SelfReview`
- Include alias suggestion: `alias self-review='flatpak run com.mateuaguilo.SelfReview'`
- Update the project structure in `AGENTS.md` to include the `flatpak/` directory

## Input Dependencies

- Tasks 01-03: Need to know the final file names and structure in `flatpak/`

## Output Artifacts

- Updated `README.md`
- Updated `AGENTS.md`

## Implementation Notes

- Keep the Flatpak instructions consistent with the existing documentation style
- Place the Flatpak section alongside existing `.deb`/`.rpm` installation sections
