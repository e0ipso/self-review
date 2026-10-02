// The one encode/decode contract for review XML text. A conformant parser turns a raw CR(LF)
// in content into LF (XML 1.0 s2.11) and a raw LF or TAB in an attribute into a space (s3.3.3),
// so the serializer writes those as character references and the parser decodes them back,
// once: a single pass over the five predefined entities and numeric references, never its own
// output. Typed `&#13;` is written `&amp;#13;` and returns as `&#13;`. The library parser's
// entity processing is off.

export interface IllegalXmlCharacter {
  codePoint: number;
  /** UTF-16 index of the offending code unit. */
  index: number;
}

/** XML 1.0 `Char`; everything else has no serialization, escaped or not. */
function isLegalXmlCodePoint(cp: number): boolean {
  return (
    cp === 0x9 ||
    cp === 0xa ||
    cp === 0xd ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  );
}

/**
 * The first character XML cannot carry, or `null`. A well-formed surrogate pair passes; a lone one
 * is reported.
 */
export function findIllegalXmlCharacter(str: string): IllegalXmlCharacter | null {
  for (let i = 0; i < str.length; i++) {
    const unit = str.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (low >= 0xdc00 && low <= 0xdfff) {
        i++;
        continue;
      }
      return { codePoint: unit, index: i };
    }
    if (!isLegalXmlCodePoint(unit)) {
      return { codePoint: unit, index: i };
    }
  }
  return null;
}

/** LF and TAB stay raw: content normalization preserves them. */
export function escapeXmlText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r/g, '&#13;');
}

/**
 * Also escapes LF and TAB, which attribute normalization turns into spaces (git filenames can
 * contain them).
 */
export function escapeXmlAttribute(str: string): string {
  return escapeXmlText(str).replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}

const PREDEFINED: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

/** A reference to a forbidden code point stays literal. */
export function decodeXmlEntities(raw: string): string {
  return raw.replace(
    /&(lt|gt|amp|quot|apos|#\d{1,8}|#x[0-9a-fA-F]{1,8});/g,
    (match, ref: string) => {
      if (ref[0] !== '#') return PREDEFINED[ref];
      const cp = ref[1] === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return isLegalXmlCodePoint(cp) ? String.fromCodePoint(cp) : match;
    }
  );
}
