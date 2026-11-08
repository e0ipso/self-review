/**
 * Encodes SVG for an `<img>`, which renders it in an isolated document (no scripts, no style
 * leakage). UTF-8 safe, unlike `btoa` alone.
 */
export function svgToDataUri(svgContent: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
}
