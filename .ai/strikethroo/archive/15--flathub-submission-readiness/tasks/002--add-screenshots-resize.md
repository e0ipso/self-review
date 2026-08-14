---
id: 2
group: 'metainfo'
dependencies: []
status: 'completed'
created: '2026-02-17'
skills:
  - image-processing
  - xml
---

# Add Screenshots to Metainfo and Resize Screenshot

## Objective

Add the required `<screenshots>` section to the AppStream metainfo XML file and resize the existing screenshot to comply with Flathub's dimension guidelines (≤2000x1400 for HiDPI).

## Skills Required

- `image-processing` — Resize PNG image
- `xml` — Edit AppStream metainfo XML

## Acceptance Criteria

- [ ] `docs/screenshot.png` resized from 2647x1525 to ≤2000x1400 (maintain aspect ratio)
- [ ] `<screenshots>` block added to `flatpak/com.mateuaguilo.SelfReview.metainfo.xml` with at least one screenshot and caption
- [ ] Screenshot URL uses a stable reference (commit SHA or tag, not `main` branch)
- [ ] The metainfo XML remains well-formed

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Flathub requires at least one screenshot for graphical desktop applications
- Screenshot dimensions must be ≤2000x1400 (HiDPI) or ≤1000x700 (1x)
- URL must be stable (tagged commit or SHA)
- Current screenshot: `docs/screenshot.png` at 2647x1525

## Input Dependencies

None — this is a root task.

## Output Artifacts

- Resized `docs/screenshot.png`
- Updated `flatpak/com.mateuaguilo.SelfReview.metainfo.xml`

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

### 1. Resize the screenshot

Use ImageMagick (or similar) to resize while maintaining aspect ratio:
```bash
convert docs/screenshot.png -resize 2000x1400 docs/screenshot.png
```

Or if `convert` is not available, try `magick` or install ImageMagick. If none available in dev container, use Python PIL or any available tool.

The current image is 2647x1525. Scaling to fit within 2000x1400:
- Scale factor by width: 2000/2647 = 0.7555
- Scaled height: 1525 * 0.7555 = 1152 (within 1400 limit)
- Result: ~2000x1152

### 2. Get a stable URL for the screenshot

The screenshot was added in commit `78cbc0b`. Use the full SHA for a stable URL. Get it:
```bash
git rev-parse 78cbc0b
```

The URL pattern:
```
https://raw.githubusercontent.com/e0ipso/self-review/<full-sha>/docs/screenshot.png
```

**Important**: Since we're resizing the screenshot in this task, the stable URL should point to the commit that contains the resized version. This means we need to commit the resized screenshot first, then use THAT commit's SHA. Alternatively, use the current `main` branch tag if a release is planned, or use the v1.9.0 tag if the screenshot at that tag is the resized version.

**Practical approach**: Since the resized screenshot will be committed as part of this work, use the latest release tag that will contain it. If no tag is available yet, note that the screenshot URL in metainfo will need updating after the changes are pushed/tagged. For now, use `main` branch and document this as a follow-up.

Actually, the simplest approach: after resizing and committing, get the commit SHA and update the URL. Or, push the resized image in a separate commit first.

**Recommended**: Use `v1.9.0` tag if the screenshot exists there. Otherwise, use the HEAD commit SHA after pushing.

### 3. Add screenshots section to metainfo

Insert before `</component>` closing tag:
```xml
<screenshots>
  <screenshot type="default">
    <caption>Split diff view showing inline review comments</caption>
    <image type="source">https://raw.githubusercontent.com/e0ipso/self-review/<stable-ref>/docs/screenshot.png</image>
  </screenshot>
</screenshots>
```

Place it after `<content_rating>` and before `<releases>`.

### 4. Validate XML is well-formed

A simple check:
```bash
xmllint --noout flatpak/com.mateuaguilo.SelfReview.metainfo.xml
```

</details>
