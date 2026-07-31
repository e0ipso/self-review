---
id: 2
group: "renderer-utilities"
dependencies: []
status: "completed"
created: "2026-02-18"
skills:
  - typescript
  - react-components
---

# Extract image-utils.ts and AttachmentThumbnail.tsx from CommentInput

## Objective

Extract image processing utility functions and the `AttachmentThumbnail` component out of `CommentInput.tsx` into their own files: `src/renderer/utils/image-utils.ts` and `src/renderer/components/Comments/AttachmentThumbnail.tsx`. Update `CommentInput.tsx` to import from the new files.

## Skills Required

- TypeScript: Moving pure async functions to a utility module
- React components: Extracting a self-contained component with its own state/lifecycle

## Acceptance Criteria

- [ ] `src/renderer/utils/image-utils.ts` exists with `resizeImageIfNeeded` and `processImageFile` exported
- [ ] `src/renderer/components/Comments/AttachmentThumbnail.tsx` exists as a standalone component
- [ ] `CommentInput.tsx` no longer contains these inline definitions — only imports from the new files
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run test:unit` passes with no regressions

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `image-utils.ts` must import the `Attachment` type from `../../shared/types`
- `AttachmentThumbnail.tsx` must import React, useState, useEffect from 'react', `Attachment` type from `../../../shared/types`, `Button` from `../ui/button`, and `ImageIcon`, `X` from `lucide-react`
- Both files are moved verbatim — no logic changes

## Input Dependencies

None — this is a standalone extraction.

## Output Artifacts

- New file: `src/renderer/utils/image-utils.ts`
- New file: `src/renderer/components/Comments/AttachmentThumbnail.tsx`
- Modified: `src/renderer/components/Comments/CommentInput.tsx`

## Implementation Notes

<details>

### Step 1: Create `src/renderer/utils/image-utils.ts`

Move lines 17-48 from `CommentInput.tsx` verbatim:

```typescript
import type { Attachment } from '../../shared/types';

export async function resizeImageIfNeeded(blob: Blob, maxDimension = 1920): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width <= maxDimension && bitmap.height <= maxDimension) {
      return blob;
    }
    const scale = Math.min(maxDimension / bitmap.width, maxDimension / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((resized) => resolve(resized || blob), blob.type);
    });
  } finally {
    bitmap.close();
  }
}

export async function processImageFile(file: File | Blob): Promise<Attachment> {
  const resized = await resizeImageIfNeeded(file);
  const arrayBuffer = await resized.arrayBuffer();
  const mediaType = file.type || 'image/png';
  const ext = mediaType.split('/')[1] || 'png';
  return {
    id: crypto.randomUUID(),
    fileName: `image.${ext}`,
    mediaType,
    data: arrayBuffer,
  };
}
```

### Step 2: Create `src/renderer/components/Comments/AttachmentThumbnail.tsx`

Move lines 50-83 from `CommentInput.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import type { Attachment } from '../../../shared/types';
import { Button } from '../ui/button';
import { X, ImageIcon } from 'lucide-react';

export default function AttachmentThumbnail({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment.data) return;
    const objectUrl = URL.createObjectURL(new Blob([attachment.data]));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [attachment.id, attachment.data]);

  return (
    <div className='relative group'>
      {url ? (
        <img
          src={url}
          alt='Attachment preview'
          className='h-16 w-16 object-cover rounded border'
        />
      ) : (
        <div className='h-16 w-16 flex items-center justify-center rounded border bg-muted'>
          <ImageIcon className='h-4 w-4 text-muted-foreground' />
        </div>
      )}
      <Button
        variant='ghost'
        size='icon'
        className='absolute -top-2 -right-2 h-5 w-5 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100'
        onClick={onRemove}
      >
        <X className='h-3 w-3' />
      </Button>
    </div>
  );
}
```

### Step 3: Update `CommentInput.tsx`

1. Delete lines 17-83 (the two utility functions and the AttachmentThumbnail component)
2. Add imports near the top of the file:
   ```typescript
   import { processImageFile } from '../../utils/image-utils';
   import AttachmentThumbnail from './AttachmentThumbnail';
   ```
3. Remove any imports that were only used by the extracted code and are no longer needed in CommentInput (check if `ImageIcon` is still used elsewhere in the file — if not, remove it from the lucide-react import)
4. `resizeImageIfNeeded` is only called by `processImageFile`, so CommentInput does not need to import it directly

### Verification

Run `npx tsc --noEmit` and `npm run test:unit`.

</details>
