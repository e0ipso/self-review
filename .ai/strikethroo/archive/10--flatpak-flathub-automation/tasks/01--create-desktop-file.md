---
id: 1
group: 'desktop-integration'
dependencies: []
status: 'completed'
created: 2026-02-17
skills:
  - freedesktop-spec
---

# Create .desktop File

## Objective

Create the FreeDesktop `.desktop` entry file for the self-review app, required by Flathub and Linux desktop environments for app launching.

## Skills Required

- FreeDesktop `.desktop` file specification

## Acceptance Criteria

- [ ] File `flatpak/com.mateuaguilo.SelfReview.desktop` exists
- [ ] Contains correct `Name`, `Exec`, `Icon`, `Categories`, and `Type` fields
- [ ] `Exec` line uses `zypak-wrapper.sh` for Electron within Flatpak sandbox
- [ ] `Categories` includes `Development`
- [ ] `Icon` references `com.mateuaguilo.SelfReview`
- [ ] File passes `desktop-file-validate` format expectations (valid syntax)

## Technical Requirements

- Follow the FreeDesktop Desktop Entry Specification
- App ID: `com.mateuaguilo.SelfReview`
- The `Exec` line should use `zypak-wrapper.sh` to launch the Electron binary inside the Flatpak sandbox
- Icon name should match the app ID (without extension) per Flatpak convention
- Terminal=false (GUI app)
- Add `StartupWMClass` for proper window association

## Input Dependencies

None — this is a standalone task.

## Output Artifacts

- `flatpak/com.mateuaguilo.SelfReview.desktop` — used by the Flatpak manifest (Task 03) for installation into the Flatpak

## Implementation Notes

- Place the file in `flatpak/` directory at the project root
- The desktop file will be installed by the Flatpak manifest into `/app/share/applications/`
