---
id: 2
group: 'desktop-integration'
dependencies: []
status: 'completed'
created: 2026-02-17
skills:
  - appstream-xml
---

# Create AppStream Metainfo XML

## Objective

Create the AppStream metainfo XML file required by Flathub for the app store listing page.

## Skills Required

- AppStream metainfo XML format

## Acceptance Criteria

- [ ] File `flatpak/com.mateuaguilo.SelfReview.metainfo.xml` exists
- [ ] Contains `<id>`, `<name>`, `<summary>`, `<description>`, `<launchable>`, `<url>`, `<developer>`, `<content_rating>`, `<releases>`, and `<metadata_license>` elements
- [ ] `<project_license>` is MIT
- [ ] `<releases>` includes the current version (1.8.0)
- [ ] File is valid AppStream metainfo XML

## Technical Requirements

- App ID: `com.mateuaguilo.SelfReview`
- License: MIT (project license), CC0-1.0 (metadata license)
- Homepage URL: `https://github.com/e0ipso/self-review`
- Description should convey: local-only PR review UI for git diffs, designed for solo developers reviewing AI-generated code
- Include `<launchable type="desktop-id">com.mateuaguilo.SelfReview.desktop</launchable>`
- Include `<content_rating type="oars-1.1"/>` (no concerning content)
- At least one `<release>` entry for the current version

## Input Dependencies

None — this is a standalone task.

## Output Artifacts

- `flatpak/com.mateuaguilo.SelfReview.metainfo.xml` — used by the Flatpak manifest (Task 03) for installation

## Implementation Notes

- Place the file in `flatpak/` directory at the project root
- Screenshots can be added later when hosted URLs are available
- The metainfo file will be installed by the manifest into `/app/share/metainfo/`
