import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseReviewXml, parseReviewXmlString } from './xml-parser';
import { MAX_RESUME_XML_BYTES } from './input-budgets';

const xml = (version: number) =>
  `<review xmlns="urn:self-review:v${version}" remote-forge="github"><file path="x" viewed="true"><comment remote-id="root" author="bot" severity="major" confidence="high" new-line-start="0"><body>&amp;#13;&#13;&#10;<![CDATA[&lt;]]></body><category>note</category><suggestion><original-code>old</original-code><proposed-code>new</proposed-code></suggestion><attachment path="root.png"/><reply author="human" remote-id="reply"><body>reply</body><attachment path="reply.png"/></reply></comment><comment><body>second</body></comment></file></review>`;

function ids() {
  let next = 0;
  return vi.fn(() => `virtual-${++next}`);
}

describe('explicit document effects', () => {
  it.each([1, 2, 3])(
    'decodes v%i with deterministic comment, reply and attachment identities',
    version => {
      const createId = ids();
      const result = parseReviewXmlString(xml(version), { createId });
      expect(createId).toHaveBeenCalledTimes(3);
      expect(result.comments[0]).toMatchObject({
        id: 'virtual-1',
        author: 'bot',
        severity: 'major',
        confidence: 'high',
        remoteId: 'root',
        lineRange: null,
        suggestion: null,
        attachments: [{ id: 'virtual-1-att-0' }],
        replies: [
          {
            id: 'virtual-2',
            body: 'reply',
            remoteId: 'reply',
            attachments: [{ id: 'virtual-2-att-0' }],
          },
        ],
      });
      expect(result.comments[1].id).toBe('virtual-3');
      expect(result.comments[0].body).toContain('&#13;\r\n&lt;');
      expect(result.comments[0].body).toContain('Imported suggestion could not be anchored');
      expect(result.importDiagnostics).toHaveLength(1);
      expect(result.viewedFiles).toEqual(['x']);
    }
  );

  it('uses the supplied reader and never replaces a refusal with native contents', () => {
    const dir = mkdtempSync(join(tmpdir(), 'xml-effects-'));
    const path = join(dir, 'review.xml');
    try {
      writeFileSync(path, '<review/>');
      const read = vi.fn(() => ({ kind: 'ok' as const, content: Buffer.from(xml(3)) }));
      expect(parseReviewXml(path, { reader: { read }, createId: ids() })).toEqual(
        parseReviewXmlString(xml(3), { createId: ids() })
      );
      expect(read).toHaveBeenCalledExactlyOnceWith(path, MAX_RESUME_XML_BYTES);
      expect(() =>
        parseReviewXml(path, {
          reader: {
            read: () => {
              throw new Error('virtual refusal');
            },
          },
        })
      ).toThrowError(
        expect.objectContaining({
          code: 'read-failed',
          message: `Could not read ${path}: virtual refusal`,
        })
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each(['<review/>', '<other/>', '<review>'])(
    'preserves default file/string results or errors for %s',
    content => {
      const dir = mkdtempSync(join(tmpdir(), 'xml-parity-'));
      const path = join(dir, 'review.xml');
      try {
        writeFileSync(path, content);
        const outcome = (parse: () => unknown) => {
          try {
            return parse();
          } catch (error) {
            return error;
          }
        };
        expect(outcome(() => parseReviewXml(path))).toEqual(
          outcome(() => parseReviewXmlString(content))
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );

  it('retains typed reader budget and non-regular failures', () => {
    expect(() =>
      parseReviewXml('virtual', {
        reader: { read: () => ({ kind: 'too-large', size: MAX_RESUME_XML_BYTES + 1 }) },
      })
    ).toThrowError(
      expect.objectContaining({
        code: 'input-too-large',
        message: expect.stringContaining('Could not read virtual'),
      })
    );
    expect(() =>
      parseReviewXml('virtual', { reader: { read: () => ({ kind: 'not-regular' }) } })
    ).toThrowError(
      expect.objectContaining({
        code: 'read-failed',
        message: 'Could not read virtual: not a regular file',
      })
    );
  });
});
