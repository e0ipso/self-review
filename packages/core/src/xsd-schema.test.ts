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
import { GUIDE_XSD_SCHEMA } from './guide-schema';
import type { ReviewState } from './types';

const REPO_ROOT = path.resolve(__dirname, '../../..');

const CANONICAL_SCHEMA =
  '.agents/skills/self-review-apply/assets/self-review-v2.xsd';

const CANONICAL_GUIDE_SCHEMA =
  '.agents/skills/self-review-guide/assets/self-review-guide-v1.xsd';

// opencode discovers skills under .opencode/skills, so those entries are
// symlinks to the .agents originals rather than copies. Byte-comparing them
// would be tautological, so guard the link itself: that is what stops a real
// copy, and the drift it invites, from creeping back in.
const SYMLINKED_SKILLS = [
  'self-review-apply',
  'self-review-critique',
  'self-review-guide',
];

const SCHEMA_FILE_NAME = 'self-review-v2.xsd';

function readCopy(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');
}

async function validate(xml: string) {
  return validateXML({
    xml: [{ fileName: 'review.xml', contents: xml }],
    schema: [{ fileName: SCHEMA_FILE_NAME, contents: XSD_SCHEMA }],
  });
}

async function validateGuide(xml: string) {
  return validateXML({
    xml: [{ fileName: 'review.guide.xml', contents: xml }],
    schema: [
      { fileName: 'self-review-guide-v1.xsd', contents: GUIDE_XSD_SCHEMA },
    ],
  });
}

function reviewXml(comments: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<review xmlns="urn:self-review:v2" timestamp="2024-01-15T10:30:00Z">',
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

  it('matches the guide schema embedded in guide-schema.ts', () => {
    // Same contract as the review schema pair: the embedded copy is the
    // on-disk file verbatim (minus the trailing newline), so any drift is a
    // mistake rather than formatting.
    expect(readCopy(CANONICAL_GUIDE_SCHEMA)).toBe(`${GUIDE_XSD_SCHEMA}\n`);
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

  it('rejects a v1-namespaced document, so the version bump is observable', async () => {
    const result = await validate(
      reviewXml('    <comment><body>b</body><category>bug</category></comment>').replace(
        'urn:self-review:v2',
        'urn:self-review:v1'
      )
    );

    expect(result.valid).toBe(false);
  });
});

describe('guide XSD conformance', () => {
  // The sync test alone would not catch a schema that is itself malformed
  // or wrongly permissive, so exercise the real validator against it.
  it('accepts a full guide with overview, groups, and provenance', async () => {
    const result = await validateGuide(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<guide xmlns="urn:self-review-guide:v1" timestamp="2026-08-01T10:30:00Z" git-diff-args="--staged" repository="/repo">',
        '  <overview>Adds retry logic.\n\n```mermaid\ngraph TD; A-->B;\n```</overview>',
        '  <group name="Core change">',
        '    <rationale>The retry wrapper everything else calls.</rationale>',
        '    <file path="src/retry.ts"><description>Adds the retry wrapper.</description></file>',
        '    <file path="src/client.ts"><description>Switches the client onto the wrapper.</description></file>',
        '  </group>',
        '  <group name="Tests">',
        '    <rationale>Coverage for the new wrapper.</rationale>',
        '    <file path="src/retry.test.ts"><description>Unit tests for backoff timing.</description></file>',
        '  </group>',
        '</guide>',
      ].join('\n')
    );

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('accepts a minimal guide with no overview and no groups', async () => {
    const result = await validateGuide(
      '<?xml version="1.0" encoding="UTF-8"?>\n<guide xmlns="urn:self-review-guide:v1" />'
    );

    expect(result.valid).toBe(true);
  });

  it('rejects a group without a rationale', async () => {
    const result = await validateGuide(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<guide xmlns="urn:self-review-guide:v1">',
        '  <group name="Core change">',
        '    <file path="src/retry.ts"><description>d</description></file>',
        '  </group>',
        '</guide>',
      ].join('\n')
    );

    expect(result.valid).toBe(false);
  });

  it('rejects an empty group, since a group exists to hold files', async () => {
    const result = await validateGuide(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<guide xmlns="urn:self-review-guide:v1">',
        '  <group name="Core change"><rationale>r</rationale></group>',
        '</guide>',
      ].join('\n')
    );

    expect(result.valid).toBe(false);
  });

  it('rejects a file entry without a description', async () => {
    const result = await validateGuide(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<guide xmlns="urn:self-review-guide:v1">',
        '  <group name="Core change">',
        '    <rationale>r</rationale>',
        '    <file path="src/retry.ts" />',
        '  </group>',
        '</guide>',
      ].join('\n')
    );

    expect(result.valid).toBe(false);
  });

  it('rejects a review-namespaced document, so the vocabularies stay distinct', async () => {
    const result = await validateGuide(
      '<?xml version="1.0" encoding="UTF-8"?>\n<guide xmlns="urn:self-review:v2" />'
    );

    expect(result.valid).toBe(false);
  });
});

describe('serializer output conforms to the schema', () => {
  // serializeReview validates internally, and nothing is mocked in this file,
  // so this exercises the real emitter against the real validator.
  it('emits a valid v2 document carrying both signals', async () => {
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

    expect(xml).toContain('xmlns="urn:self-review:v2"');
    expect(xml).toContain('severity="critical" confidence="high"');
    expect((await validate(xml)).valid).toBe(true);
  });
});
