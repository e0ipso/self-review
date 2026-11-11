import type { Attachment } from '@self-review/types';

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_PIXELS = 16_000_000;
export const IMAGE_MAX_DIMENSION = 8192;
const HEADER_BYTES = 64 * 1024;

export class ImageAttachmentError extends Error {
  constructor(public readonly code: 'size' | 'dimensions' | 'format' | 'decode') {
    super(code);
  }
}

/** Inspect bounded raster headers before asking the browser to allocate a decoded bitmap. */
export function imageDimensions(bytes: ArrayBuffer): { width: number; height: number } {
  const v = new DataView(bytes);
  const b = new Uint8Array(bytes);
  const ascii = (at: number, text: string) =>
    [...text].every((c, i) => b[at + i] === c.charCodeAt(0));
  if (b.length >= 24 && b[0] === 137 && ascii(1, 'PNG\r\n\x1a\n'))
    return { width: v.getUint32(16), height: v.getUint32(20) };
  if (b.length >= 10 && (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')))
    return { width: v.getUint16(6, true), height: v.getUint16(8, true) };
  if (b.length >= 26 && ascii(0, 'BM')) {
    const core = v.getUint32(14, true) === 12;
    return {
      width: core ? v.getUint16(18, true) : Math.abs(v.getInt32(18, true)),
      height: core ? v.getUint16(20, true) : Math.abs(v.getInt32(22, true)),
    };
  }
  if (b.length >= 6 && v.getUint32(0, true) === 0x00010000) {
    const count = v.getUint16(4, true);
    if (!count || 6 + count * 16 > b.length) throw new ImageAttachmentError('format');
    let width = 0,
      height = 0;
    for (let at = 6; at < 6 + count * 16; at += 16) {
      width = Math.max(width, b[at] || 256);
      height = Math.max(height, b[at + 1] || 256);
    }
    return { width, height };
  }
  if (b.length >= 30 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) {
    if (ascii(12, 'VP8X'))
      return {
        width: 1 + b[24] + (b[25] << 8) + (b[26] << 16),
        height: 1 + b[27] + (b[28] << 8) + (b[29] << 16),
      };
    if (ascii(12, 'VP8L') && b[20] === 0x2f)
      return {
        width: 1 + b[21] + ((b[22] & 0x3f) << 8),
        height: 1 + (b[22] >> 6) + (b[23] << 2) + ((b[24] & 0xf) << 10),
      };
    if (ascii(12, 'VP8 ') && b[23] === 0x9d && b[24] === 1 && b[25] === 0x2a)
      return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let at = 2;
    while (at + 4 <= b.length) {
      if (b[at++] !== 0xff) break;
      while (b[at] === 0xff) at++;
      const marker = b[at++];
      if (marker === 0xd9 || marker === 0xda || at + 2 > b.length) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      const size = v.getUint16(at);
      if (size < 2 || at + size > b.length) break;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker) && size >= 7)
        return { width: v.getUint16(at + 5), height: v.getUint16(at + 3) };
      at += size;
    }
  }
  throw new ImageAttachmentError('format');
}
function checkDimensions(width: number, height: number) {
  if (
    width <= 0 ||
    height <= 0 ||
    width > IMAGE_MAX_DIMENSION ||
    height > IMAGE_MAX_DIMENSION ||
    width * height > IMAGE_MAX_PIXELS
  )
    throw new ImageAttachmentError('dimensions');
}

async function resizeImageIfNeeded(
  blob: Blob,
  signal?: AbortSignal,
  maxDimension = 1920
): Promise<Blob> {
  signal?.throwIfAborted();
  if (blob.size > IMAGE_MAX_BYTES) throw new ImageAttachmentError('size');
  const size = imageDimensions(await blob.slice(0, HEADER_BYTES).arrayBuffer());
  checkDimensions(size.width, size.height);
  signal?.throwIfAborted();
  const bitmap = await createImageBitmap(blob);
  try {
    signal?.throwIfAborted();
    checkDimensions(bitmap.width, bitmap.height);
    if (bitmap.width <= maxDimension && bitmap.height <= maxDimension) return blob;
    const scale = Math.min(maxDimension / bitmap.width, maxDimension / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageAttachmentError('decode');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const resized = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, blob.type));
    signal?.throwIfAborted();
    if (!resized || resized.size > IMAGE_MAX_BYTES) throw new ImageAttachmentError('decode');
    return resized;
  } finally {
    bitmap.close();
  }
}

export async function processImageFile(
  file: File | Blob,
  signal?: AbortSignal
): Promise<Attachment> {
  const resized = await resizeImageIfNeeded(file, signal);
  const arrayBuffer = await resized.arrayBuffer();
  signal?.throwIfAborted();
  const mediaType = resized.type || file.type || 'image/png';
  const ext = mediaType.split('/')[1] || 'png';
  return { id: crypto.randomUUID(), fileName: `image.${ext}`, mediaType, data: arrayBuffer };
}
