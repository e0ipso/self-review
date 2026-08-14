---
id: 1
group: 'manifest'
dependencies: []
status: 'completed'
created: '2026-02-17'
skills:
  - flatpak
  - bash
---

# Convert Manifest to extra-data Architecture

## Objective

Restructure the Flatpak manifest (`flatpak/com.mateuaguilo.SelfReview.yml`) so the `.deb` uses `extra-data` source type instead of `file`, add an `apply_extra` script for install-time extraction, fix all sha256 checksums, add the LICENSE file as a build source, and update `build-commands` to install only metadata at build time.

## Skills Required

- `flatpak` — Flatpak manifest syntax, extra-data sources, apply_extra scripts
- `bash` — Shell scripting for apply_extra, computing sha256 checksums

## Acceptance Criteria

- [ ] `.deb` source changed from `type: file` to `type: extra-data` with valid `sha256`, `size` (88713642), and `installed-size` fields
- [ ] `x-checker-data` preserved and updated for extra-data compatibility (includes `size-query`)
- [ ] `apply_extra` script added as `type: script` source that extracts the `.deb` and places app files in the correct location
- [ ] `build-commands` install only metadata: `.desktop`, `.metainfo.xml`, icon SVG, LICENSE, wrapper script (`self-review.sh`)
- [ ] SVG icon source has real sha256 (not FIXME placeholder)
- [ ] LICENSE file added as a `type: file` source fetched from the repo and installed to `/app/share/licenses/com.mateuaguilo.SelfReview/LICENSE`
- [ ] Wrapper script (`self-review.sh`) updated to point to `/app/extra/self-review/` instead of `/app/lib/self-review/`
- [ ] Manifest is valid YAML

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Flatpak `extra-data` source type: https://docs.flatpak.org/en/latest/flatpak-builder-command-reference.html
- `apply_extra` runs in sandbox with only `/app/extra` accessible
- The `.deb` at install time is placed in the current directory (not `/app/extra` yet — apply_extra script runs in the extra-data directory)

## Input Dependencies

None — this is a root task.

## Output Artifacts

- Updated `flatpak/com.mateuaguilo.SelfReview.yml` manifest

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### 1. Compute sha256 for the SVG icon

Download and hash the SVG icon:
```bash
curl -sL https://raw.githubusercontent.com/e0ipso/self-review/main/assets/icon.svg | sha256sum
```

### 2. Convert .deb source to extra-data

Replace the current `.deb` `file` source with:
```yaml
- type: extra-data
  filename: self-review.deb
  url: https://github.com/e0ipso/self-review/releases/download/v1.8.0/self-review_1.8.0_amd64.deb
  sha256: 8667fac98822d7c2f287b207406dd986191f811de17de3142b8ca95862068dad
  size: 88713642
  x-checker-data:
    type: json
    url: https://api.github.com/repos/e0ipso/self-review/releases/latest
    version-query: .tag_name | sub("^v"; "")
    url-query: .assets[] | select(.name | test("amd64\\.deb$")) | .browser_download_url
    size-query: .assets[] | select(.name | test("amd64\\.deb$")) | .size
```

Note: `extra-data` uses `filename` not `dest-filename`, and requires `size`.

### 3. Add apply_extra script

Add a new `type: script` source with `dest-filename: apply_extra`:
```yaml
- type: script
  dest-filename: apply_extra
  commands:
    - ar x self-review.deb
    - tar xf data.tar.*
    - mv usr/share/self-review .
    - rm -rf self-review.deb usr control.tar.* data.tar.* debian-binary
```

This script runs at install time in the extra-data directory. It extracts the `.deb` and places the Electron app at `/app/extra/self-review/`.

### 4. Add LICENSE file source

Add a `type: file` source for the LICENSE:
```yaml
- type: file
  url: https://raw.githubusercontent.com/e0ipso/self-review/v1.8.0/LICENSE
  sha256: <compute this>
  dest-filename: LICENSE
```

Compute the sha256:
```bash
curl -sL https://raw.githubusercontent.com/e0ipso/self-review/v1.8.0/LICENSE | sha256sum
```

Use a tagged URL (v1.8.0) for stability. If that fails, use the commit SHA.

### 5. Update build-commands

Replace current build-commands with metadata-only installs:
```yaml
build-commands:
  - install -Dm644 com.mateuaguilo.SelfReview.desktop /app/share/applications/com.mateuaguilo.SelfReview.desktop
  - install -Dm644 com.mateuaguilo.SelfReview.metainfo.xml /app/share/metainfo/com.mateuaguilo.SelfReview.metainfo.xml
  - install -Dm644 com.mateuaguilo.SelfReview.svg /app/share/icons/hicolor/scalable/apps/com.mateuaguilo.SelfReview.svg
  - install -Dm644 LICENSE /app/share/licenses/com.mateuaguilo.SelfReview/LICENSE
  - install -Dm755 self-review.sh /app/bin/self-review
  - install -Dm755 apply_extra /app/bin/apply_extra
```

Note: `ar x` and `tar xf` are removed from build-commands — they move to `apply_extra`.

### 6. Update wrapper script (self-review.sh)

The wrapper must point to the extra-data location:
```yaml
- type: script
  dest-filename: self-review.sh
  commands:
    - export TMPDIR="$XDG_RUNTIME_DIR/app/$FLATPAK_ID"
    - exec zypak-wrapper /app/extra/self-review/self-review "$@"
```

### 7. Verify the final manifest is valid YAML

Run a quick YAML parse check.

</details>
