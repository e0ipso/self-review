const RASTER_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.bmp']);

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filePath.length - 1) return '';
  return filePath.slice(lastDot).toLowerCase();
}

export function isPreviewableImage(filePath: string): boolean {
  return RASTER_IMAGE_EXTENSIONS.has(getExtension(filePath));
}

export function isPreviewableSvg(filePath: string): boolean {
  return getExtension(filePath) === '.svg';
}
