function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    if (character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) return true;
  }
  return false;
}

/** Resolve a content URL in review-relative coordinates, never against the app document. */
export function resolveReviewedMediaPath(reference: string, documentPath?: string): string | null {
  const source = reference.trim();
  if (!source || hasControlCharacters(source) || source.includes('\\') || source.startsWith('//'))
    return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(source)) return null;
  const pathname = source.split(/[?#]/, 1)[0];
  if (!pathname) return null;
  const segments = pathname.startsWith('/') ? [] : (documentPath?.split('/').slice(0, -1) ?? []);
  if (
    segments.some(
      segment => !segment || segment === '.' || segment === '..' || segment.includes('\\')
    )
  )
    return null;
  try {
    for (const encoded of pathname.split('/')) {
      const segment = decodeURIComponent(encoded);
      // Decode once. A separator inside a segment has ambiguous URL/path semantics.
      if (hasControlCharacters(segment) || segment.includes('/') || segment.includes('\\'))
        return null;
      if (!segment || segment === '.') continue;
      if (segment === '..') {
        if (!segments.length) return null;
        segments.pop();
      } else {
        segments.push(segment);
      }
    }
  } catch {
    return null;
  }
  return segments.length ? segments.join('/') : null;
}
