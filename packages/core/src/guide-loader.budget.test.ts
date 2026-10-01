// Guide sidecar budget, against the real filesystem: an oversized or
// non-regular guide is refused before it is read whole or parsed.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadGuide } from './guide-loader';
import { parseGuideXml } from './guide-parser';
import { MAX_GUIDE_BYTES } from './input-budgets';

vi.mock('./guide-parser', async importOriginal => {
  const actual = await importOriginal<typeof import('./guide-parser')>();
  return { ...actual, parseGuideXml: vi.fn(actual.parseGuideXml) };
});

const GUIDE_HEAD = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<guide xmlns="urn:self-review-guide:v1">',
  '  <group name="Core change">',
  '    <rationale>The retry wrapper.</rationale>',
  '    <file path="src/retry.ts"><description>Adds the retry wrapper.</description></file>',
  '  </group>',
].join('\n');

describe('loadGuide input budget', () => {
  let dir: string;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'self-review-test-guide-budget-'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(parseGuideXml).mockClear();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads a guide within the budget', async () => {
    writeFileSync(join(dir, 'review.guide.xml'), `${GUIDE_HEAD}\n</guide>\n`);

    const payload = await loadGuide(join(dir, 'review.xml'), {}, ['src/retry.ts']);

    expect(payload?.groups[0].name).toBe('Core change');
  });

  it('ignores an oversized guide with one warning, without parsing it', async () => {
    // Well-formed and schema-valid apart from its size: padding in a comment.
    const padding = `<!-- ${'x'.repeat(MAX_GUIDE_BYTES)} -->`;
    writeFileSync(join(dir, 'review.guide.xml'), `${GUIDE_HEAD}\n${padding}\n</guide>\n`);

    const payload = await loadGuide(join(dir, 'review.xml'), {}, ['src/retry.ts']);

    expect(payload).toBeNull();
    expect(parseGuideXml).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/too large/);
    expect(String(errorSpy.mock.calls[0][0])).toContain('1 MiB');
  });

  it.skipIf(process.platform === 'win32')(
    'ignores a FIFO guide with one warning instead of blocking on it',
    async () => {
      execFileSync('mkfifo', [join(dir, 'review.guide.xml')]);

      const payload = await loadGuide(join(dir, 'review.xml'), {}, ['src/retry.ts']);

      expect(payload).toBeNull();
      expect(parseGuideXml).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0][0])).toMatch(/not a regular file/);
    }
  );
});
