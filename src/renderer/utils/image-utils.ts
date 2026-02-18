import type { Attachment } from '../../shared/types';

async function resizeImageIfNeeded(blob: Blob, maxDimension = 1920): Promise<Blob> {
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
