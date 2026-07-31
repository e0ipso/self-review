---
id: 3
group: 'flatpak-packaging'
dependencies: [1, 2]
status: 'completed'
created: 2026-02-17
skills:
  - flatpak-manifest
---

# Create Flatpak Manifest

## Objective

Author the Flatpak build manifest that Flathub's buildbot uses to create the Flatpak package, including `x-checker-data` for auto-update detection.

## Skills Required

- Flatpak manifest authoring (YAML format)

## Acceptance Criteria

- [ ] File `flatpak/com.mateuaguilo.SelfReview.yml` exists
- [ ] Uses `org.freedesktop.Platform` / `org.freedesktop.Sdk` runtime (24.08)
- [ ] Uses `org.electronjs.Electron2.BaseApp` base app
- [ ] Source downloads the Linux x64 `.zip` from GitHub Releases
- [ ] Installs `.desktop` file, metainfo XML, and icon into correct Flatpak paths
- [ ] Sandbox permissions: `--share=ipc`, `--socket=x11`, `--socket=wayland`, `--device=dri`, `--filesystem=host:ro`, `--talk-name=org.freedesktop.Notifications`
- [ ] No `--share=network` permission
- [ ] Contains `x-checker-data` annotations for `flatpak-external-data-checker` auto-updates
- [ ] Contains `flathub.json` with `automerge-flathubbot-prs` enabled

## Technical Requirements

- Manifest format: YAML
- Runtime: `org.freedesktop.Platform//24.08`
- SDK: `org.freedesktop.Sdk//24.08`
- Base app: `org.electronjs.Electron2.BaseApp//24.08`
- Module type: Use `builtin` or shell commands to install the pre-built Electron app
- The install step should:
  1. Extract the Linux zip into `/app/lib/self-review/`
  2. Copy `.desktop` file to `/app/share/applications/`
  3. Copy metainfo to `/app/share/metainfo/`
  4. Copy SVG icon to `/app/share/icons/hicolor/scalable/apps/com.mateuaguilo.SelfReview.svg`
  5. Create a launcher script using `zypak-wrapper.sh`
- `x-checker-data` should use `type: json` with GitHub Releases API
- Create `flatpak/flathub.json` with `{"automerge-flathubbot-prs": true}`

## Input Dependencies

- Task 01: `.desktop` file (referenced and installed by manifest)
- Task 02: AppStream metainfo XML (referenced and installed by manifest)

## Output Artifacts

- `flatpak/com.mateuaguilo.SelfReview.yml` — the Flatpak manifest
- `flatpak/flathub.json` — Flathub auto-merge configuration

## Implementation Notes

- This manifest will live in the Flathub repo but a reference copy is kept in `flatpak/`
- The icon SVG is at `assets/icon.svg` in the project — it needs to be referenced for installation
- Use the existing logo-square.svg or assets/icon.svg — check which exists and is suitable
