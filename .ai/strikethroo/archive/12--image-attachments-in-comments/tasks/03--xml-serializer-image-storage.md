---
id: 3
group: "main-process"
dependencies: [1, 2]
status: "completed"
created: "2026-02-16"
skills: ["typescript", "xml-serialization"]
complexity_score: 4.5
complexity_notes: "Combines XML element emission with file I/O for image storage. Two related but distinct operations in a single serialization pass."
---

# Extend XML Serializer to Emit Attachments and Write Image Files

## Objective

Update the XML serializer to write image files to a `.self-review-assets/` directory and emit `<attachment>` elements in the XML output referencing those files.

## Skills Required

- `typescript`: File I/O, buffer handling
- `xml-serialization`: Building XML elements, attribute emission

## Acceptance Criteria

- [ ] `serializeReview` (or its internal helpers) writes attachment image data to `.self-review-assets/` directory alongside the XML output file
- [ ] `.self-review-assets/` directory is created on-demand only when attachments exist
- [ ] Image files are named `{comment-id}-{index}.{ext}` (e.g., `c1-0.png`)
- [ ] `<attachment path=".self-review-assets/c1-0.png" media-type="image/png" />` elements emitted in the XML for each attachment
- [ ] The `data` field is stripped from attachments before XML emission (only path and media-type appear)
- [ ] If no comments have attachments, no directory is created and XML output is unchanged
- [ ] Output XML validates against the updated XSD

## Technical Requirements

- The asset directory path is derived from the output file path: same parent directory + `.self-review-assets/`
- Extension is derived from media type: `image/png` → `.png`, `image/jpeg` → `.jpg`, `image/webp` → `.webp`
- Use `fs.mkdirSync` with `{ recursive: true }` for directory creation
- Use `fs.writeFileSync` for image files (synchronous is fine — this runs once at exit)

## Input Dependencies

- Task 1: `Attachment` type with `data: ArrayBuffer` field
- Task 2: Updated XSD with `AttachmentType`

## Output Artifacts

- Updated `src/main/xml-serializer.ts` with attachment serialization and image file writing logic

## Implementation Notes

<details>

### Step 1: Read `src/main/xml-serializer.ts`

Understand the current serialization flow: how `serializeReview` is called, how `buildCommentXml` works, and how the output file path is determined.

### Step 2: Add image file writing

Before or during XML building, iterate through all comments with attachments. For each attachment with `data`:

1. Derive the asset directory: `path.join(path.dirname(outputFilePath), '.self-review-assets')`
2. Create the directory if it doesn't exist: `fs.mkdirSync(assetDir, { recursive: true })`
3. Derive the filename: `${comment.id}-${index}.${extFromMediaType(attachment.mediaType)}`
4. Write the file: `fs.writeFileSync(path.join(assetDir, fileName), Buffer.from(attachment.data))`
5. Set the relative path on the attachment for XML emission: `.self-review-assets/${fileName}`

Helper function for media type to extension:

```typescript
function extFromMediaType(mediaType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mediaType] || 'png';
}
```

### Step 3: Emit `<attachment>` elements in XML

In `buildCommentXml` (or equivalent), after the suggestion element, emit attachment elements:

```typescript
if (comment.attachments?.length) {
  for (const att of comment.attachments) {
    xml += `  <attachment path="${escapeXml(att.fileName)}" media-type="${escapeXml(att.mediaType)}" />\n`;
  }
}
```

Note: `att.fileName` at this point should contain the relative path (set during the file writing step). Use whatever XML escaping utility already exists in the serializer.

### Step 4: Update function signature if needed

The `serializeReview` function may need the output file path passed in (to derive the asset directory). Check if it already has access to it or if the signature needs updating. Propagate the change to callers (likely in `main.ts` or `ipc-handlers.ts`).

</details>
