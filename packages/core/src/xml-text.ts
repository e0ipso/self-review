// packages/core/src/xml-text.ts
// The one encode/decode contract for text inside review XML.
//
// XML is not a transparent container for strings. A conformant parser
// normalizes a raw CR or CRLF in content to LF (XML 1.0 §2.11) and turns a
// raw LF or TAB inside an attribute value into a space (§3.3.3). The only
// representation that survives every parser byte for byte is a character
// reference, so the serializer writes those three characters as `&#13;`,
// `&#10;` and `&#9;` where normalization would otherwise eat them, and the
// parser decodes them back — once.
//
// "Once" is the whole point. The decoder below is a single regex pass that
// knows exactly the five predefined entities and decimal/hex character
// references, and nothing else: no HTML named entities, no re-scanning of
// its own output. A user who types the literal text `&#13;` has it written
// as `&amp;#13;` and gets `&#13;` back, not a carriage return. The library
// parser's own entity processing is switched off so this is the only place
// decoding ever happens.

/** A code point XML 1.0 forbids, and where it sits in the string. */
export interface IllegalXmlCharacter {
  codePoint: number;
  /** UTF-16 index of the offending code unit. */
  index: number;
}

/**
 * XML 1.0 `Char`: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] |
 * [#x10000-#x10FFFF]. Everything else — the other C0 controls, U+FFFE,
 * U+FFFF and surrogate code points on their own — has no serialization at
 * all, escaped or not, and a document carrying one is not XML.
 */
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
 * Find the first character XML cannot carry, or `null` when the string is
 * clean. Lone surrogates are reported at the surrogate itself: a well-formed
 * pair is read as its supplementary code point and passes.
 */
export function findIllegalXmlCharacter(str: string): IllegalXmlCharacter | null {
  for (let i = 0; i < str.length; i++) {
    const unit = str.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (low >= 0xdc00 && low <= 0xdfff) {
        i++; // a well-formed pair: always a legal supplementary code point
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

/**
 * Escape a string for element content. The five markup characters become
 * their predefined entities and CR becomes `&#13;`; LF and TAB are left raw,
 * because content normalization preserves them.
 */
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
 * Escape a string for an attribute value: everything {@link escapeXmlText}
 * does, plus LF and TAB as references, because attribute-value normalization
 * turns the raw characters into spaces. Valid Git filenames can contain all
 * three.
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

/**
 * Decode exactly the five predefined entities and decimal/hex character
 * references, in one pass over the raw text. A reference to a code point XML
 * forbids, or to nothing at all, is left as the literal text it was.
 */
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
