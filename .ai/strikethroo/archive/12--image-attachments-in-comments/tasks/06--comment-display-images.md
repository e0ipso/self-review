---
id: 6
group: "renderer"
dependencies: [1]
status: "completed"
created: "2026-02-16"
skills: ["react-components"]
---

# Render Image Attachments in CommentDisplay

## Objective

Extend `CommentDisplay` to show image attachments below the comment body. Handle both in-memory images (current session) and file-path-only images (resumed sessions) with graceful degradation for missing files.

## Skills Required

- `react-components`: Conditional rendering, async data loading, shadcn/ui integration

## Acceptance Criteria

- [ ] Comments with in-memory attachment data display images rendered from ArrayBuffer via `URL.createObjectURL`
- [ ] Resumed comments with file paths (no `data`) load images via `window.electronAPI.readAttachment()` IPC call
- [ ] Missing or unreadable image files show a "Missing image" placeholder (not a broken image icon)
- [ ] Multiple attachments render in a horizontal row below the comment body
- [ ] Images are clickable to view at full size (or open in a lightbox — a simple approach is fine)
- [ ] Object URLs are properly revoked on cleanup

## Technical Requirements

- Use `useEffect` + `useState` for async loading of resumed attachment images
- For in-memory images: `URL.createObjectURL(new Blob([attachment.data]))`
- For file-path images: call `window.electronAPI.readAttachment(path)`, then create object URL from returned buffer
- Placeholder for missing images: a small styled div with an `ImageOff` icon from lucide-react and "Image not found" text
- Stderr warning for missing images is handled by the main process IPC handler (Task 1)

## Input Dependencies

- Task 1: `Attachment` type, `ElectronAPI.readAttachment` method

## Output Artifacts

- Updated `src/renderer/components/Comments/CommentDisplay.tsx`

## Implementation Notes

<details>

### Step 1: Read `src/renderer/components/Comments/CommentDisplay.tsx`

Understand how comments are currently rendered, where the body and suggestion are displayed, and identify where to add the attachment rendering section.

### Step 2: Create attachment image component

Create a small internal component (within the file or extracted if reusable) that handles a single attachment:

```tsx
function AttachmentImage({ attachment }: { attachment: Attachment }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (attachment.data) {
      const url = URL.createObjectURL(new Blob([attachment.data]));
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    // Load from file path for resumed attachments
    if (attachment.fileName) {
      window.electronAPI.readAttachment(attachment.fileName).then((buffer) => {
        if (buffer) {
          const url = URL.createObjectURL(new Blob([buffer]));
          setImageUrl(url);
        } else {
          setError(true);
        }
      }).catch(() => setError(true));
    }
    return undefined;
  }, [attachment]);

  // Cleanup URL on unmount for file-loaded images
  useEffect(() => {
    return () => {
      if (imageUrl && !attachment.data) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl, attachment.data]);

  if (error) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground text-sm p-2 border rounded bg-muted">
        <ImageOff className="h-4 w-4" />
        <span>Image not found</span>
      </div>
    );
  }

  if (!imageUrl) return null; // Loading

  return (
    <img
      src={imageUrl}
      alt="Attachment"
      className="max-h-48 rounded border cursor-pointer hover:opacity-80"
      onClick={() => window.open(imageUrl, '_blank')}
    />
  );
}
```

### Step 3: Render attachments in CommentDisplay

After the comment body (and suggestion block if present), add:

```tsx
{comment.attachments && comment.attachments.length > 0 && (
  <div className="flex gap-2 flex-wrap mt-2">
    {comment.attachments.map((att) => (
      <AttachmentImage key={att.id} attachment={att} />
    ))}
  </div>
)}
```

### Step 4: Handle the file path for resumed attachments

For resumed attachments, `attachment.fileName` contains the relative path from the XML (e.g., `.self-review-assets/c1-0.png`). The IPC handler needs the full path. Check how the output file path is available in the renderer context — you may need to resolve the relative path against the output file's directory. If the output file path isn't available in the renderer, this may require passing it via the `config:load` IPC channel or adding a small utility.

</details>
