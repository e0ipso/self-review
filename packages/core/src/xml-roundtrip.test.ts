// Round-trips against the real XSD validator and Python's expat-backed parser, to prove the
// xml-text.ts contract is not specific to fast-xml-parser.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { serializeReview } from './xml-serializer';
import { parseReviewXmlString } from './xml-parser';
import type { ReviewState } from './types';

const hasPython =
  spawnSync('python3', ['-c', 'import xml.etree.ElementTree'], {
    stdio: 'ignore',
  }).status === 0;

interface Fixture {
  name: string;
  filePath: string;
  body: string;
  category: string;
  originalCode: string;
  proposedCode: string;
  replyBody: string;
}

const FIXTURES: Fixture[] = [
  {
    name: 'numeric- and boolean-looking strings',
    filePath: 'src/007.ts',
    body: '00123',
    category: '007',
    originalCode: '0',
    proposedCode: 'false',
    replyBody: '1e3',
  },
  {
    name: 'entity-looking literal text',
    filePath: 'a&amp;b.ts',
    body: '&#13; &amp; &lt;x&gt; &nbsp; &amp;#10;',
    category: '&quot;',
    originalCode: '&#x41;',
    proposedCode: '&amp;amp;',
    replyBody: '&apos;',
  },
  {
    name: 'CRLF, lone CR and TAB in text',
    filePath: 'src/crlf.ts',
    body: 'one\r\ntwo\rthree\tfour\n',
    category: 'bug',
    originalCode: 'if (a) {\r\n\treturn;\r\n}\r\n',
    proposedCode: 'if (a) return;\r',
    replyBody: '\t\r\n',
  },
  {
    name: 'quote, backslash and newline in the filename',
    filePath: 'dir/we"ird\\name\nwith\tnewline.ts',
    body: 'path check',
    category: 'note',
    originalCode: 'x',
    proposedCode: 'y',
    replyBody: 'ok',
  },
  {
    name: 'empty strings',
    filePath: 'src/empty.ts',
    body: '',
    category: '',
    originalCode: '',
    proposedCode: '',
    replyBody: '',
  },
];

function stateFor(f: Fixture): ReviewState {
  return {
    timestamp: '2026-01-01T00:00:00.000Z',
    source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
    files: [
      {
        path: f.filePath,
        changeType: 'modified',
        viewed: true,
        comments: [
          {
            id: 'c1',
            filePath: f.filePath,
            lineRange: { side: 'new', start: 3, end: 4 },
            body: f.body,
            category: f.category,
            suggestion: { originalCode: f.originalCode, proposedCode: f.proposedCode },
            author: f.category,
            replies: [{ id: 'r1', body: f.replyBody, author: f.body }],
          },
        ],
      },
    ],
  };
}

/** What a second parser read out of the document, field by field. */
const PY_EXTRACT = `
import json, sys, xml.etree.ElementTree as ET
ns = {'sr': 'urn:self-review:v3'}
root = ET.parse(sys.argv[1]).getroot()
file = root.find('sr:file', ns)
comment = file.find('sr:comment', ns)
suggestion = comment.find('sr:suggestion', ns)
reply = comment.find('sr:reply', ns)
def t(el):
    return el.text if el.text is not None else ''
print(json.dumps({
    'filePath': file.get('path'),
    'body': t(comment.find('sr:body', ns)),
    'category': t(comment.find('sr:category', ns)),
    'originalCode': t(suggestion.find('sr:original-code', ns)),
    'proposedCode': t(suggestion.find('sr:proposed-code', ns)),
    'replyBody': t(reply.find('sr:body', ns)),
    'author': comment.get('author'),
    'replyAuthor': reply.get('author'),
}, ensure_ascii=False))
`;

describe('review XML round-trip with the real validator', () => {
  const tmpDirs: string[] = [];
  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it.each(FIXTURES.map(f => [f.name, f] as const))(
    'validates against the v3 XSD and parses back byte-for-byte: %s',
    async (_name, fixture) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-roundtrip-'));
      tmpDirs.push(dir);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const state = stateFor(fixture);

      const { xml } = await serializeReview(state, path.join(dir, 'review.xml'));

      // serializeReview throws on a schema violation and only *warns* when the
      // validator could not load; the absence of that warning is what proves
      // validation actually ran.
      const logged = errorSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(logged).not.toContain('validation infrastructure failed');
      expect(xml).not.toContain('\r');

      const parsed = parseReviewXmlString(xml);
      expect(parsed.importDiagnostics).toEqual([]);
      expect(parsed.viewedFiles).toEqual([fixture.filePath]);
      const [comment] = parsed.comments;
      expect(comment).toMatchObject({
        filePath: fixture.filePath,
        lineRange: { side: 'new', start: 3, end: 4 },
        body: fixture.body,
        category: fixture.category,
        suggestion: { originalCode: fixture.originalCode, proposedCode: fixture.proposedCode },
      });
      expect(comment.replies?.[0].body).toBe(fixture.replyBody);
      // The serializer omits an empty author attribute; absent reads as human.
      expect(comment.author).toBe(fixture.category === '' ? undefined : fixture.category);

      // Saving the parsed state again reproduces the same bytes.
      const again = await serializeReview(
        {
          ...state,
          files: [
            {
              ...state.files[0],
              comments: [{ ...comment, id: 'c1', replies: [{ ...comment.replies![0], id: 'r1' }] }],
            },
          ],
        },
        path.join(dir, 'review.xml')
      );
      expect(again.xml).toBe(xml);
    }
  );

  it.skipIf(!hasPython).each(FIXTURES.map(f => [f.name, f] as const))(
    'a conformant parser (Python xml.etree) recovers the same bytes: %s',
    async (_name, fixture) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-roundtrip-py-'));
      tmpDirs.push(dir);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const xmlPath = path.join(dir, 'review.xml');
      fs.writeFileSync(xmlPath, (await serializeReview(stateFor(fixture), xmlPath)).xml);

      const read = JSON.parse(
        execFileSync('python3', ['-c', PY_EXTRACT, xmlPath], { encoding: 'utf-8' })
      );

      expect(read).toEqual({
        filePath: fixture.filePath,
        body: fixture.body,
        category: fixture.category,
        originalCode: fixture.originalCode,
        proposedCode: fixture.proposedCode,
        replyBody: fixture.replyBody,
        author: fixture.category === '' ? null : fixture.category,
        replyAuthor: fixture.body === '' ? null : fixture.body,
      });
    }
  );
});
