---
id: 4
group: "main-process"
dependencies: [1, 2]
status: "completed"
created: "2026-02-16"
skills: ["typescript", "xml-parsing"]
---

# Update XML Parser to Handle Attachment Elements on Resume

## Objective

Extend the XML parser to extract `<attachment>` elements from the XML when loading a prior review via `--resume-from`. Attachments are parsed as metadata only (path + media-type) — image data is NOT loaded into memory.

## Skills Required

- `typescript`: XML parsing, data transformation
- `xml-parsing`: Extracting elements and attributes from XML DOM

## Acceptance Criteria

- [ ] `<attachment>` elements within `<comment>` are parsed into `Attachment` objects on the `ReviewComment`
- [ ] Parsed attachments have `fileName` (the path from the XML attribute), `mediaType`, and `id` populated
- [ ] `data` field is left `undefined` for resumed attachments (image data is loaded on-demand by the renderer via IPC)
- [ ] Comments without attachments are unaffected
- [ ] Parser handles XML files from before this feature (no `<attachment>` elements) without errors

## Technical Requirements

- Follow the existing parsing pattern in `src/main/xml-parser.ts` for extracting child elements
- The `path` attribute value becomes the `fileName` field on the `Attachment` object
- Generate a deterministic `id` for resumed attachments (e.g., derive from comment ID + index)

## Input Dependencies

- Task 1: `Attachment` interface definition
- Task 2: XSD schema showing the `<attachment>` element structure

## Output Artifacts

- Updated `src/main/xml-parser.ts`

## Implementation Notes

<details>

### Step 1: Read `src/main/xml-parser.ts`

Understand how comments are currently parsed: how child elements like `<suggestion>` are extracted, and how `ReviewComment` objects are constructed.

### Step 2: Add attachment parsing

After parsing the `<suggestion>` element (if any), look for `<attachment>` child elements:

```typescript
const attachmentElements = commentEl.getElementsByTagName('attachment');
const attachments: Attachment[] = [];

for (let i = 0; i < attachmentElements.length; i++) {
  const attEl = attachmentElements[i];
  attachments.push({
    id: `${comment.id}-att-${i}`,
    fileName: attEl.getAttribute('path') || '',
    mediaType: attEl.getAttribute('media-type') || 'image/png',
    // data is intentionally undefined — loaded on-demand via IPC
  });
}

if (attachments.length > 0) {
  comment.attachments = attachments;
}
```

### Step 3: Verify backward compatibility

Ensure that when no `<attachment>` elements exist, `getElementsByTagName('attachment')` returns an empty list and the comment is constructed without the `attachments` field. This preserves behavior for older XML files.

</details>
