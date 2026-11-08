import { describe, it, expect } from 'vitest';
import {
  decodeXmlEntities,
  escapeXmlAttribute,
  escapeXmlText,
  findIllegalXmlCharacter,
} from './xml-text';

describe('escapeXmlText', () => {
  it.each([
    [
      'the five predefined characters',
      `a & b < c > d " e ' f`,
      'a &amp; b &lt; c &gt; d &quot; e &apos; f',
    ],
    ['a carriage return, as a numeric reference', 'a\r\nb\rc', 'a&#13;\nb&#13;c'],
    ['a tab and a line feed untouched in text', 'a\tb\nc', 'a\tb\nc'],
    [
      'entity-looking literal text, so it cannot be decoded twice',
      '&#13; &amp; &lt;',
      '&amp;#13; &amp;amp; &amp;lt;',
    ],
    ['an empty string', '', ''],
  ])('escapes %s', (_name, input, expected) => {
    expect(escapeXmlText(input)).toBe(expected);
  });
});

describe('escapeXmlAttribute', () => {
  it('additionally encodes LF and TAB, which attribute normalization would turn into spaces', () => {
    expect(escapeXmlAttribute('dir/a\nb\tc\r\nd "q" \'s\' <&>')).toBe(
      'dir/a&#10;b&#9;c&#13;&#10;d &quot;q&quot; &apos;s&apos; &lt;&amp;&gt;'
    );
  });
});

describe('decodeXmlEntities', () => {
  it.each([
    [
      'the five predefined entities',
      '&lt;a&gt; &amp; &quot;q&quot; &apos;s&apos;',
      `<a> & "q" 's'`,
    ],
    ['decimal numeric references', 'a&#13;&#10;b&#9;c', 'a\r\nb\tc'],
    ['hex numeric references, digits in either case', '&#x41;&#x4a;&#x1F600;', 'AJ\u{1F600}'],
    ['a literal the serializer double-escaped, in one pass', '&amp;#13;', '&#13;'],
    ['a double-escaped predefined entity, in one pass', '&amp;lt;', '&lt;'],
    ['a double-escaped ampersand entity, in one pass', '&amp;amp;', '&amp;'],
    ['text with no references', 'plain\n\ttext', 'plain\n\ttext'],
  ])('decodes %s', (_name, input, expected) => {
    expect(decodeXmlEntities(input)).toBe(expected);
  });

  it.each([
    ['an HTML named entity (full HTML entity decoding is not enabled)', '&nbsp;&copy;'],
    ['a bare ampersand', 'a & b'],
    ['an unterminated reference', '&amp &#13'],
    ['a numeric reference to an XML-illegal code point', '&#0;&#1;&#xFFFE;&#xD800;'],
    ['a numeric reference beyond U+10FFFF', '&#1114112;&#x110000;'],
    ['a numeric reference too long to be a code point', '&#99999999999999999999;'],
  ])('leaves %s as literal text', (_name, input) => {
    expect(decodeXmlEntities(input)).toBe(input);
  });
});

describe('findIllegalXmlCharacter', () => {
  it('accepts every legal XML 1.0 character class', () => {
    expect(findIllegalXmlCharacter('\t\n\r \u007F\u0085퟿�\u{10000}\u{10FFFF}')).toBeNull();
  });

  it.each([
    ['NUL', 'a\u0000b', 0x0000, 1],
    ['a C0 control other than TAB/LF/CR', 'x\u001Bm', 0x001b, 1],
    ['U+FFFE', '￾', 0xfffe, 0],
    ['U+FFFF', 'ok￿', 0xffff, 2],
    ['a lone high surrogate', 'a\uD800', 0xd800, 1],
    ['a lone low surrogate', '\uDC00a', 0xdc00, 0],
  ])('reports %s with its code point and index', (_name, input, codePoint, index) => {
    expect(findIllegalXmlCharacter(input)).toEqual({ codePoint, index });
  });
});
