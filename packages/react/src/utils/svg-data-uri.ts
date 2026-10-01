/**
 * Encode SVG markup as a `data:image/svg+xml;base64` URI for an `<img>`.
 *
 * An SVG loaded through `<img>` is rendered in its own isolated document:
 * scripts never run, its stylesheets reach nothing outside the image, and
 * nothing in it can be positioned over the page. The encoding is UTF-8 safe
 * (`btoa` alone rejects code points above U+00FF).
 */
export function svgToDataUri(svgContent: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
}
