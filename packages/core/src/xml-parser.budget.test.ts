import { afterEach, describe, expect, it, vi } from 'vitest';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { parseReviewXmlString } from './xml-parser';
import { MAX_RESUME_XML_BYTES } from './input-budgets';
import { ReviewXmlError } from './xml-errors';

vi.mock('./input-budgets', async importOriginal => ({
  ...(await importOriginal<typeof import('./input-budgets')>()),
  MAX_RESUME_XML_BYTES: 4096,
}));
vi.mock('fast-xml-parser', async importOriginal => {
  const actual = await importOriginal<typeof import('fast-xml-parser')>();
  return {
    ...actual,
    XMLParser: vi.fn(function (options) {
      return new actual.XMLParser(options);
    }),
  };
});
afterEach(() => vi.restoreAllMocks());

function document(version: number, body: string): string {
  return `<review xmlns="urn:self-review:v${version}"><file path="é🙂.ts" viewed="true"><comment new-line-start="1" new-line-end="1"><body>${body}</body><category>note</category></comment></file></review>`;
}

function fillDocument(version: number): { xml: string; body: string } {
  const available = MAX_RESUME_XML_BYTES - Buffer.byteLength(document(version, ''));
  const body = 'é🙂'.repeat(Math.floor(available / 6)) + 'x'.repeat(available % 6);
  return { xml: document(version, body), body };
}

describe('public string parsing document budget', () => {
  it.each([1, 2, 3])('accepts exactly the UTF-8 limit for v%i without losing text', version => {
    const { xml, body } = fillDocument(version);
    expect(Buffer.byteLength(xml)).toBe(MAX_RESUME_XML_BYTES);
    const result = parseReviewXmlString(xml);
    expect(result.comments[0]).toMatchObject({
      filePath: 'é🙂.ts',
      body,
      lineRange: { side: 'new', start: 1, end: 1 },
    });
    expect(result.viewedFiles).toEqual(['é🙂.ts']);
    expect(result.importDiagnostics).toEqual([]);
  });

  it.each([1, 2, 3])('refuses one extra UTF-8 byte for v%i before XML allocations', version => {
    const validate = vi.spyOn(XMLValidator, 'validate');
    vi.mocked(XMLParser).mockClear();
    const { xml } = fillDocument(version);
    expect(() => parseReviewXmlString(xml + ' ')).toThrowError(
      expect.objectContaining({ name: 'ReviewXmlError', code: 'input-too-large' })
    );
    expect(validate).not.toHaveBeenCalled();
    expect(XMLParser).not.toHaveBeenCalled();
  });

  it.each(['x', 'é', '🙂'])(
    'rejects oversized malformed %s input before well-formedness checks',
    unit => {
      const validate = vi.spyOn(XMLValidator, 'validate');
      vi.mocked(XMLParser).mockClear();
      const xml =
        '<review>' + unit.repeat(Math.floor(MAX_RESUME_XML_BYTES / Buffer.byteLength(unit)));
      expect(() => parseReviewXmlString(xml)).toThrowError(
        expect.objectContaining({ code: 'input-too-large' })
      );
      expect(validate).not.toHaveBeenCalled();
      expect(XMLParser).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['<review>', 'parse-failed'],
    ['<other />', 'missing-root'],
  ])('retains the in-budget error distinction for %s', (xml, code) => {
    expect(() => parseReviewXmlString(xml)).toThrowError(
      expect.objectContaining({ name: 'ReviewXmlError', code })
    );
    try {
      parseReviewXmlString(xml);
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewXmlError);
    }
  });

  it('retains single entity decoding, CDATA, whitespace and code in an in-budget document', () => {
    const xml = document(3, '  &amp;#13;&#13;&#10;&#9;é🙂<![CDATA[&lt;]]>  ');
    expect(parseReviewXmlString(xml).comments[0].body).toBe('  &#13;\r\n\té🙂&lt;  ');
  });
});
