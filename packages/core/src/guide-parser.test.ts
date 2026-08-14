// Tests for the walkthrough guide parser and the tolerant reconciliation
// with the diff file list. The real xmllint-wasm validator runs here (no
// mocks): defective documents are an expected real-world state, and the
// tolerance contract — failures are values, never exceptions — is the
// behavior under test. If parseGuideXml is ever changed to throw on bad
// input, the failure-mode tests below fail.

import { describe, it, expect } from 'vitest';
import type { ReviewGuide } from './types';
import { parseGuideXml, reconcileGuide } from './guide-parser';

function guideXml(body: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<guide xmlns="urn:self-review-guide:v1">',
    body,
    '</guide>',
  ].join('\n');
}

const VALID_GUIDE = guideXml(
  [
    '  <overview>Adds retry logic; start with the wrapper.</overview>',
    '  <group name="Core change">',
    '    <rationale>The retry wrapper everything else calls.</rationale>',
    '    <file path="src/retry.ts"><description>Adds the retry wrapper.</description></file>',
    '    <file path="src/client.ts"><description>Switches the client onto the wrapper.</description></file>',
    '  </group>',
    '  <group name="Tests">',
    '    <rationale>Coverage for the new wrapper.</rationale>',
    '    <file path="src/retry.test.ts"><description>Unit tests for backoff timing.</description></file>',
    '  </group>',
  ].join('\n')
);

describe('parseGuideXml', () => {
  it('parses a valid guide into the typed structure, preserving order', async () => {
    const result = await parseGuideXml(VALID_GUIDE);

    expect(result).toEqual({
      ok: true,
      guide: {
        overview: 'Adds retry logic; start with the wrapper.',
        groups: [
          {
            name: 'Core change',
            rationale: 'The retry wrapper everything else calls.',
            files: [
              { path: 'src/retry.ts', description: 'Adds the retry wrapper.' },
              {
                path: 'src/client.ts',
                description: 'Switches the client onto the wrapper.',
              },
            ],
          },
          {
            name: 'Tests',
            rationale: 'Coverage for the new wrapper.',
            files: [
              {
                path: 'src/retry.test.ts',
                description: 'Unit tests for backoff timing.',
              },
            ],
          },
        ],
      },
    });
  });

  it('parses a minimal guide with no overview and no groups', async () => {
    const result = await parseGuideXml(
      '<?xml version="1.0" encoding="UTF-8"?>\n<guide xmlns="urn:self-review-guide:v1" />'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.guide.overview).toBeUndefined();
      expect(result.guide.groups).toEqual([]);
    }
  });

  it('parses a single-group, single-file guide (no array wrapping quirks)', async () => {
    // fast-xml-parser returns an object instead of a one-element array for
    // singular elements; this pins the normalization.
    const result = await parseGuideXml(
      guideXml(
        [
          '  <group name="Only">',
          '    <rationale>r</rationale>',
          '    <file path="a.ts"><description>d</description></file>',
          '  </group>',
        ].join('\n')
      )
    );

    expect(result).toEqual({
      ok: true,
      guide: {
        groups: [
          {
            name: 'Only',
            rationale: 'r',
            files: [{ path: 'a.ts', description: 'd' }],
          },
        ],
      },
    });
  });

  it('returns a failure value for non-XML garbage instead of throwing', async () => {
    const result = await parseGuideXml('this is not XML at all <<<%%%');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toEqual(expect.any(String));
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('returns a failure value for an empty string', async () => {
    const result = await parseGuideXml('');

    expect(result.ok).toBe(false);
  });

  it('returns a failure value for well-formed XML that violates the schema', async () => {
    // A group without a rationale is schema-invalid.
    const result = await parseGuideXml(
      guideXml(
        [
          '  <group name="Core change">',
          '    <file path="src/retry.ts"><description>d</description></file>',
          '  </group>',
        ].join('\n')
      )
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toEqual(expect.any(String));
    }
  });

  it('parses a guide that binds the correct namespace to a prefix', async () => {
    // Schema-valid: XSD validation is namespace-based, not prefix-based. An
    // LLM authoring from the schema alone may well emit this form.
    const result = await parseGuideXml(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sg:guide xmlns:sg="urn:self-review-guide:v1">',
        '  <sg:overview>o</sg:overview>',
        '  <sg:group name="Core change">',
        '    <sg:rationale>r</sg:rationale>',
        '    <sg:file path="a.ts"><sg:description>d</sg:description></sg:file>',
        '  </sg:group>',
        '</sg:guide>',
      ].join('\n')
    );

    expect(result).toEqual({
      ok: true,
      guide: {
        overview: 'o',
        groups: [
          {
            name: 'Core change',
            rationale: 'r',
            files: [{ path: 'a.ts', description: 'd' }],
          },
        ],
      },
    });
  });

  it('returns a failure value for a document in the wrong namespace', async () => {
    const result = await parseGuideXml(
      '<?xml version="1.0" encoding="UTF-8"?>\n<guide xmlns="urn:self-review:v2" />'
    );

    expect(result.ok).toBe(false);
  });
});

describe('reconcileGuide', () => {
  const guide: ReviewGuide = {
    overview: 'o',
    groups: [
      {
        name: 'Core change',
        rationale: 'core',
        files: [
          { path: 'src/retry.ts', description: 'wrapper' },
          { path: 'src/client.ts', description: 'caller' },
        ],
      },
      {
        name: 'Tests',
        rationale: 'tests',
        files: [{ path: 'src/retry.test.ts', description: 'unit tests' }],
      },
    ],
  };

  it('preserves guide group and file order, appending unmentioned diff files to a terminal implicit group in diff order', () => {
    const resolved = reconcileGuide(guide, [
      'README.md',
      'src/client.ts',
      'src/retry.test.ts',
      'src/retry.ts',
      'zzz/last.ts',
    ]);

    expect(resolved).toEqual([
      {
        name: 'Core change',
        rationale: 'core',
        implicit: false,
        files: [
          { path: 'src/retry.ts', description: 'wrapper' },
          { path: 'src/client.ts', description: 'caller' },
        ],
      },
      {
        name: 'Tests',
        rationale: 'tests',
        implicit: false,
        files: [{ path: 'src/retry.test.ts', description: 'unit tests' }],
      },
      {
        name: 'Everything else',
        implicit: true,
        files: [{ path: 'README.md' }, { path: 'zzz/last.ts' }],
      },
    ]);
  });

  it('drops guide entries whose path is not in the diff, and drops groups left empty', () => {
    const resolved = reconcileGuide(guide, ['src/client.ts']);

    expect(resolved).toEqual([
      {
        name: 'Core change',
        rationale: 'core',
        implicit: false,
        files: [{ path: 'src/client.ts', description: 'caller' }],
      },
    ]);
  });

  it('keeps a file referenced by two groups only in the first', () => {
    const duplicated: ReviewGuide = {
      groups: [
        {
          name: 'First',
          rationale: 'r1',
          files: [{ path: 'a.ts', description: 'from first' }],
        },
        {
          name: 'Second',
          rationale: 'r2',
          files: [
            { path: 'a.ts', description: 'from second' },
            { path: 'b.ts', description: 'b' },
          ],
        },
      ],
    };

    const resolved = reconcileGuide(duplicated, ['a.ts', 'b.ts']);

    expect(resolved).toEqual([
      {
        name: 'First',
        rationale: 'r1',
        implicit: false,
        files: [{ path: 'a.ts', description: 'from first' }],
      },
      {
        name: 'Second',
        rationale: 'r2',
        implicit: false,
        files: [{ path: 'b.ts', description: 'b' }],
      },
    ]);
  });

  it('puts every diff file into the implicit group when the guide has no groups', () => {
    const resolved = reconcileGuide({ groups: [] }, ['b.ts', 'a.ts']);

    expect(resolved).toEqual([
      {
        name: 'Everything else',
        implicit: true,
        files: [{ path: 'b.ts' }, { path: 'a.ts' }],
      },
    ]);
  });

  it('omits the implicit group when the guide accounts for every diff file', () => {
    const resolved = reconcileGuide(guide, [
      'src/retry.ts',
      'src/client.ts',
      'src/retry.test.ts',
    ]);

    expect(resolved).toHaveLength(2);
    expect(resolved.every(group => !group.implicit)).toBe(true);
  });

  it('returns an empty result for an empty diff', () => {
    expect(reconcileGuide(guide, [])).toEqual([]);
  });
});
