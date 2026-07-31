// Guards the XSD contract itself: that the on-disk schema and the copy embedded
// in xml-serializer.ts agree, that the opencode harness still reaches the schema
// through a symlink rather than a duplicate, and that the schema actually accepts
// the documents the serializer emits.
//
// This lives in its own file because xml-serializer.test.ts mocks xmllint-wasm
// away, so validation there is a no-op. Here the real validator runs.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateXML } from 'xmllint-wasm';
import { XSD_SCHEMA, serializeReview } from './xml-serializer';
import type { ReviewState } from './types';

const REPO_ROOT = path.resolve(__dirname, '../../..');

const CANONICAL_SCHEMA =
  '.agents/skills/self-review-apply/assets/self-review-v3.xsd';

// opencode discovers skills under .opencode/skills, so those entries are
// symlinks to the .agents originals rather than copies. Byte-comparing them
// would be tautological, so guard the link itself: that is what stops a real
// copy, and the drift it invites, from creeping back in.
const SYMLINKED_SKILLS = ['self-review-apply', 'self-review-critique'];

const SCHEMA_FILE_NAME = 'self-review-v3.xsd';

function readCopy(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');
}

async function validate(xml: string) {
  return validateXML({
    xml: [{ fileName: 'review.xml', contents: xml }],
    schema: [{ fileName: SCHEMA_FILE_NAME, contents: XSD_SCHEMA }],
  });
}

function reviewXml(comments: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<review xmlns="urn:self-review:v3" timestamp="2024-01-15T10:30:00Z">',
    '  <file path="src/main.ts" change-type="modified" viewed="true">',
    comments,
    '  </file>',
    '</review>',
  ].join('\n');
}

describe('XSD schema copies', () => {
  it('matches the schema embedded in xml-serializer.ts', () => {
    // Exact equality, not normalized: the embedded copy is generated from the
    // on-disk file verbatim, so any drift is a mistake rather than formatting.
    expect(readCopy(CANONICAL_SCHEMA)).toBe(`${XSD_SCHEMA}\n`);
  });

  it.each(SYMLINKED_SKILLS)(
    '.opencode/skills/%s is a symlink to the .agents copy, not a duplicate',
    name => {
      const link = path.join(REPO_ROOT, '.opencode/skills', name);

      expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
      expect(path.resolve(path.dirname(link), fs.readlinkSync(link))).toBe(
        path.join(REPO_ROOT, '.agents/skills', name)
      );
    }
  );
});

describe('XSD conformance', () => {
  it('accepts every severity and confidence value', async () => {
    const severities = ['critical', 'major', 'minor', 'info'];
    const confidences = ['high', 'medium', 'low'];
    const comments = severities
      .flatMap(severity =>
        confidences.map(
          confidence =>
            `    <comment new-line-start="1" new-line-end="1" severity="${severity}" confidence="${confidence}"><body>b</body><category>bug</category></comment>`
        )
      )
      .join('\n');

    const result = await validate(reviewXml(comments));

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('accepts comments that omit both signals, since absent is a valid position', async () => {
    const result = await validate(
      reviewXml('    <comment><body>b</body><category>bug</category></comment>')
    );

    expect(result.valid).toBe(true);
  });

  it('rejects a severity value outside the enumeration', async () => {
    const result = await validate(
      reviewXml('    <comment severity="blocker"><body>b</body><category>bug</category></comment>')
    );

    expect(result.valid).toBe(false);
  });

  it('rejects a confidence value outside the enumeration', async () => {
    const result = await validate(
      reviewXml('    <comment confidence="certain"><body>b</body><category>bug</category></comment>')
    );

    expect(result.valid).toBe(false);
  });

  it('accepts a comment carrying an ordered list of replies', async () => {
    const result = await validate(
      reviewXml(
        [
          '    <comment new-line-start="1" new-line-end="1">',
          '      <body>b</body>',
          '      <category>bug</category>',
          '      <reply><body>first turn</body></reply>',
          '      <reply author="Claude Opus 5"><body>second turn</body></reply>',
          '    </comment>',
        ].join('\n')
      )
    );

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it.each([
    ['nested', '<reply><body>r</body><reply><body>nested</body></reply></reply>'],
    ['categorized', '<reply><body>r</body><category>bug</category></reply>'],
    ['thresholded', '<reply severity="major"><body>r</body></reply>'],
    [
      'suggesting',
      '<reply><body>r</body><suggestion><original-code>a</original-code><proposed-code>b</proposed-code></suggestion></reply>',
    ],
  ])(
    'rejects a %s reply, since a reply is a flat turn without its own metadata',
    async (_label, reply) => {
      const result = await validate(
        reviewXml(`    <comment><body>b</body><category>bug</category>${reply}</comment>`)
      );

      expect(result.valid).toBe(false);
    }
  );

  it('accepts an attachment on a reply, in the same position it takes on a comment', async () => {
    const result = await validate(
      reviewXml(
        [
          '    <comment>',
          '      <body>b</body>',
          '      <category>bug</category>',
          '      <reply>',
          '        <body>see the capture</body>',
          '        <attachment path=".self-review-assets/c1-r-r1-0.png" media-type="image/png" />',
          '      </reply>',
          '    </comment>',
        ].join('\n')
      )
    );

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('rejects a reply whose attachment precedes its body, since the sequence is fixed', async () => {
    const result = await validate(
      reviewXml(
        [
          '    <comment><body>b</body><category>bug</category>',
          '      <reply>',
          '        <attachment path="a.png" media-type="image/png" />',
          '        <body>see the capture</body>',
          '      </reply>',
          '    </comment>',
        ].join('\n')
      )
    );

    expect(result.valid).toBe(false);
  });

  it('rejects a v2-namespaced document, so the version bump is observable', async () => {
    const result = await validate(
      reviewXml('    <comment><body>b</body><category>bug</category></comment>').replace(
        'urn:self-review:v3',
        'urn:self-review:v2'
      )
    );

    expect(result.valid).toBe(false);
  });
});

describe('serializer output conforms to the schema', () => {
  // serializeReview validates internally, and nothing is mocked in this file,
  // so this exercises the real emitter against the real validator.
  it('emits a valid v3 document carrying both signals', async () => {
    const state: ReviewState = {
      timestamp: '2024-01-15T10:30:00Z',
      source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
      files: [
        {
          path: 'src/main.ts',
          changeType: 'modified',
          viewed: true,
          comments: [
            {
              id: 'c1',
              filePath: 'src/main.ts',
              lineRange: { side: 'new', start: 5, end: 7 },
              body: 'Traced defect',
              category: 'bug',
              suggestion: { originalCode: 'a', proposedCode: 'b' },
              author: 'Claude Opus 5',
              severity: 'critical',
              confidence: 'high',
            },
            {
              id: 'c2',
              filePath: 'src/main.ts',
              lineRange: null,
              body: 'Human note with no signals',
              category: 'note',
              suggestion: null,
            },
          ],
        },
      ],
    };

    const xml = await serializeReview(state, '/tmp/test-review.xml');

    expect(xml).toContain('xmlns="urn:self-review:v3"');
    expect(xml).toContain('severity="critical" confidence="high"');
    expect((await validate(xml)).valid).toBe(true);
  });

  it('emits a valid v3 document carrying a three-reply thread', async () => {
    const state: ReviewState = {
      timestamp: '2024-01-15T10:30:00Z',
      source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
      files: [
        {
          path: 'src/main.ts',
          changeType: 'modified',
          viewed: true,
          comments: [
            {
              id: 'c1',
              filePath: 'src/main.ts',
              lineRange: { side: 'new', start: 5, end: 7 },
              body: 'Traced defect',
              category: 'bug',
              suggestion: { originalCode: 'a', proposedCode: 'b' },
              author: 'Claude Opus 5',
              severity: 'major',
              confidence: 'medium',
              replies: [
                { id: 'r1', body: 'reply 1' },
                { id: 'r2', body: 'reply 2', author: 'Claude Opus 5' },
                { id: 'r3', body: 'reply 3' },
              ],
            },
          ],
        },
      ],
    };

    const xml = await serializeReview(state, '/tmp/test-review-replies.xml');

    expect((await validate(xml)).valid).toBe(true);
    // Document order is conversation order, and it is the only ordering signal.
    expect([...xml.matchAll(/<body>(reply [123])<\/body>/g)].map(m => m[1])).toEqual([
      'reply 1',
      'reply 2',
      'reply 3',
    ]);
    expect(xml).toContain('<reply>');
    expect(xml).toContain('<reply author="Claude Opus 5">');
  });

  it('emits a valid document when a reply body carries a fenced code block', async () => {
    // Replies are where a human pastes a counter-proposal, since a reply has no
    // suggestion element. A single unescaped & or < here would leave the
    // document unparseable, so validity is the assertion that matters.
    const state: ReviewState = {
      timestamp: '2024-01-15T10:30:00Z',
      source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
      files: [
        {
          path: 'src/main.ts',
          changeType: 'modified',
          viewed: true,
          comments: [
            {
              id: 'c1',
              filePath: 'src/main.ts',
              lineRange: null,
              body: 'Root finding',
              category: 'bug',
              suggestion: null,
              replies: [
                {
                  id: 'r1',
                  body: ['```ts', 'if (a < b && c > d) emit("<x>");', '```'].join('\n'),
                },
              ],
            },
          ],
        },
      ],
    };

    const xml = await serializeReview(state, '/tmp/test-review-fenced-reply.xml');

    expect((await validate(xml)).valid).toBe(true);
    expect(xml).toContain('if (a &lt; b &amp;&amp; c &gt; d) emit(&quot;&lt;x&gt;&quot;);');
  });
});
