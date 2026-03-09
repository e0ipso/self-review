import path from 'path';

const RASTER_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.bmp']);

export function isPreviewableImage(filePath: string): boolean {
  return RASTER_IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isPreviewableSvg(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.svg';
}
