---
id: 5
group: "renderer"
dependencies: [1]
status: "completed"
created: "2026-02-16"
skills: ["react-components", "typescript"]
complexity_score: 5
complexity_notes: "Multiple interaction patterns (paste, file picker, preview, resize) but all within a single component. Clipboard/Canvas APIs add technical depth."
---

# Add Image Attachment UX to CommentInput

## Objective

Extend the `CommentInput` component to support pasting images from clipboard and attaching images via file picker. Display attached images as thumbnails with remove capability. Resize oversized images using the Canvas API. Integrate with the `@uiw/react-md-editor` via `textareaProps`.

## Skills Required

- `react-components`: Component state, event handlers, shadcn/ui integration
- `typescript`: Clipboard API, File API, Canvas API for resizing

## Acceptance Criteria

- [ ] Pasting an image from clipboard into the markdown editor captures it as an attachment (not inline text)
- [ ] An "Attach" button (using shadcn/ui `Button` with Paperclip icon from lucide-react) opens a native file picker (`accept="image/*"`)
- [ ] Attached images display as thumbnails below the editor with a remove (X) button
- [ ] Images exceeding 1920px in either dimension are resized proportionally using Canvas API
- [ ] On comment submit, attachments are included in the `addComment` / `editComment` call
- [ ] Normal text paste behavior is preserved when clipboard contains no image data
- [ ] Component works in both light and dark themes

## Technical Requirements

- Use `textareaProps.onPaste` on the `@uiw/react-md-editor` to intercept paste events
- Check `clipboardData.items` for `type.startsWith('image/')` or `clipboardData.files`
- Use `FileReader.readAsArrayBuffer()` to get image data
- Use `URL.createObjectURL(new Blob([arrayBuffer]))` for thumbnail previews
- Canvas API for resize: create offscreen canvas, draw image scaled, export as blob
- Track attachments in local component state (`useState<Attachment[]>`)
- Hidden `<input type="file" accept="image/*" multiple>` triggered by the attach button
- Use shadcn/ui components for the button and layout
- Use `Paperclip` icon from `lucide-react` for the attach button, `X` icon for remove

## Input Dependencies

- Task 1: `Attachment` interface, `ElectronAPI` type updates

## Output Artifacts

- Updated `src/renderer/components/Comments/CommentInput.tsx`
- May need to update `src/renderer/hooks/useReviewState.ts` and `src/renderer/context/ReviewContext.tsx` if `addComment`/`editComment` signatures need to accommodate attachments

## Implementation Notes

<details>

### Step 1: Read existing files

Read these files to understand the current implementation:
- `src/renderer/components/Comments/CommentInput.tsx`
- `src/renderer/hooks/useReviewState.ts`
- `src/renderer/context/ReviewContext.tsx`

Understand how `@uiw/react-md-editor` is used, how `textareaProps` is passed, and how comments are submitted.

### Step 2: Add image resize utility

Create a helper function (can be in the same file or a small utility):

```typescript
async function resizeImageIfNeeded(blob: Blob, maxDimension: number = 1920): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width <= maxDimension && img.height <= maxDimension) {
        resolve(blob);
        return;
      }
      const scale = Math.min(maxDimension / img.width, maxDimension / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((resized) => resolve(resized || blob), blob.type);
    };
    img.src = url;
  });
}
```

### Step 3: Add attachment state

In `CommentInput`, add:

```typescript
const [attachments, setAttachments] = useState<Attachment[]>([]);
```

Add helper to process a File/Blob into an Attachment:

```typescript
async function processImageFile(file: File | Blob): Promise<Attachment> {
  const resized = await resizeImageIfNeeded(file instanceof File ? file : file);
  const arrayBuffer = await resized.arrayBuffer();
  const mediaType = file.type || 'image/png';
  const ext = mediaType.split('/')[1] || 'png';
  return {
    id: crypto.randomUUID(),
    fileName: `image.${ext}`, // Temporary name; final name assigned by serializer
    mediaType,
    data: arrayBuffer,
  };
}
```

### Step 4: Wire paste handler via textareaProps

On the `MDEditor` component, add/extend `textareaProps`:

```typescript
textareaProps={{
  ...existingTextareaProps,
  onPaste: async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        const attachment = await processImageFile(file);
        setAttachments(prev => [...prev, attachment]);
      }
    }
    // If no image, normal paste proceeds
  },
}}
```

### Step 5: Add file picker

Add a hidden file input and a button to trigger it:

```tsx
const fileInputRef = useRef<HTMLInputElement>(null);

<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  multiple
  style={{ display: 'none' }}
  onChange={async (e) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = await Promise.all(files.map(processImageFile));
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = ''; // Reset for re-selection
  }}
/>
<Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
  <Paperclip className="h-4 w-4 mr-1" />
  Attach
</Button>
```

### Step 6: Render thumbnail previews

Below the editor, render attached images:

```tsx
{attachments.length > 0 && (
  <div className="flex gap-2 flex-wrap mt-2">
    {attachments.map((att) => (
      <div key={att.id} className="relative group">
        <img
          src={URL.createObjectURL(new Blob([att.data!]))}
          alt="Attachment preview"
          className="h-16 w-16 object-cover rounded border"
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100"
          onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    ))}
  </div>
)}
```

Note: Object URLs should be revoked when attachments are removed or component unmounts (use `useEffect` cleanup).

### Step 7: Include attachments on submit

When the comment is submitted, pass the attachments array to `addComment` or `editComment`. Check if the existing function signatures accept attachments; if not, update `useReviewState` and `ReviewContext` to accept an optional `attachments` parameter on these functions.

### Step 8: Handle edit mode

When editing an existing comment that has attachments, pre-populate the `attachments` state with the existing attachments. For resumed attachments without `data`, load the image via `window.electronAPI.readAttachment(att.fileName)`.

</details>
