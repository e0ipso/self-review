// Internal review XML writer. Charge encoded bytes before retaining or escaping a value;
// only a document that fits is joined. No file I/O or schema validation happens here.
import { MAX_RESUME_XML_BYTES, formatBytes } from './input-budgets';
import { ReviewXmlError, XmlIllegalCharacterError } from './xml-errors';
import type { XmlIllegalCharacterLocation } from './xml-errors';
import { escapeXmlAttribute, escapeXmlText, findIllegalXmlCharacter } from './xml-text';

export class ReviewXmlWriter {
  private readonly parts: string[] = [];
  // Publication appends one LF; the returned XML still has no trailing newline.
  private bytes = 1;

  append(literal: string): void {
    this.charge(Buffer.byteLength(literal, 'utf8'));
    this.parts.push(literal);
  }

  attribute(name: string, value: string, location: XmlIllegalCharacterLocation): void {
    this.append(` ${name}="`);
    this.escaped(value, location, true);
    this.append('"');
  }

  element(
    indent: string,
    name: string,
    value: string,
    location: XmlIllegalCharacterLocation
  ): void {
    this.append(`${indent}<${name}>`);
    this.escaped(value, location, false);
    this.append(`</${name}>\n`);
  }

  finish(): string {
    return this.parts.join('');
  }

  private escaped(value: string, location: XmlIllegalCharacterLocation, attribute: boolean): void {
    const illegal = findIllegalXmlCharacter(value);
    if (illegal) throw new XmlIllegalCharacterError(illegal.codePoint, location);
    // Every escaped code unit costs at least one byte. No large encoding or escaped
    // duplicate is allocated before this lower bound and the exact byte charges pass.
    if (value.length > MAX_RESUME_XML_BYTES - this.bytes) this.tooLarge();
    for (let i = 0; i < value.length; i++) {
      const unit = value.charCodeAt(i);
      let bytes: number;
      switch (unit) {
        case 38:
          bytes = 5;
          break; // &amp;
        case 60:
        case 62:
          bytes = 4;
          break; // &lt; &gt;
        case 34:
        case 39:
          bytes = 6;
          break; // &quot; &apos;
        case 13:
          bytes = 5;
          break; // &#13;
        case 10:
          bytes = attribute ? 5 : 1;
          break; // &#10;
        case 9:
          bytes = attribute ? 4 : 1;
          break; // &#9;
        default:
          if (unit <= 0x7f) bytes = 1;
          else if (unit <= 0x7ff) bytes = 2;
          else if (unit >= 0xd800 && unit <= 0xdbff) {
            // Already checked: high surrogates always have a matching low surrogate.
            bytes = 4;
            i++;
          } else bytes = 3;
      }
      this.charge(bytes);
    }
    this.parts.push(attribute ? escapeXmlAttribute(value) : escapeXmlText(value));
  }

  private charge(bytes: number): void {
    if (bytes > MAX_RESUME_XML_BYTES - this.bytes) this.tooLarge();
    this.bytes += bytes;
  }

  private tooLarge(): never {
    const message =
      `The serialized review exceeds the ${formatBytes(MAX_RESUME_XML_BYTES)} review document ` +
      'limit including its final newline';
    throw new ReviewXmlError('input-too-large', message, { details: [message] });
  }
}
