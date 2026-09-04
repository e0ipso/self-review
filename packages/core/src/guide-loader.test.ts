// Tests for main-process guide discovery and tolerant loading.
// Path derivation and the invalid-guide fallback are the meaningful
// behaviors; Electron IPC plumbing is deliberately untested (framework
// code), matching the rest of the main-process suite.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import { deriveGuidePath, resolveGuidePath, loadGuide } from './guide-loader';

vi.mock('fs/promises');

function fsError(code: string, message: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(message);
  error.code = code;
  return error;
}

const VALID_GUIDE_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<guide xmlns="urn:self-review-guide:v1">',
  '  <overview>Adds retry logic; start with the wrapper.</overview>',
  '  <group name="Core change">',
  '    <rationale>The retry wrapper everything else calls.</rationale>',
  '    <file path="src/retry.ts"><description>Adds the retry wrapper.</description></file>',
  '  </group>',
  '</guide>',
].join('\n');

describe('deriveGuidePath', () => {
  it('replaces the final extension of the default output name with .guide.xml', () => {
    expect(deriveGuidePath('/work/review.xml')).toBe('/work/review.guide.xml');
  });

  it('handles a custom output filename', () => {
    expect(deriveGuidePath('/work/my-review.xml')).toBe(
      '/work/my-review.guide.xml'
    );
  });

  it('strips only the last extension of a multi-dot filename', () => {
    expect(deriveGuidePath('/work/release.notes.xml')).toBe(
      '/work/release.notes.guide.xml'
    );
  });

  it('appends .guide.xml verbatim when the output filename has no extension', () => {
    expect(deriveGuidePath('/work/review')).toBe('/work/review.guide.xml');
  });
});

describe('resolveGuidePath', () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    process.cwd = vi.fn().mockReturnValue('/workspace/project');
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  it('derives from the output path when no guide-file override is set', () => {
    expect(resolveGuidePath('/work/review.xml', {})).toBe(
      '/work/review.guide.xml'
    );
  });

  it('uses the guide-file config override, resolved against cwd', () => {
    expect(resolveGuidePath('/work/review.xml', { guideFile: 'walkthrough.xml' })).toBe(
      '/workspace/project/walkthrough.xml'
    );
  });

  it('uses an absolute guide-file override as-is', () => {
    expect(
      resolveGuidePath('/work/review.xml', { guideFile: '/elsewhere/g.xml' })
    ).toBe('/elsewhere/g.xml');
  });
});

describe('loadGuide', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('returns null silently when the guide file is missing', async () => {
    vi.mocked(readFile).mockRejectedValue(
      fsError('ENOENT', 'no such file or directory')
    );

    const payload = await loadGuide('/work/review.xml', {}, ['src/retry.ts']);

    expect(payload).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns null with exactly one stderr warning when the file is unreadable', async () => {
    vi.mocked(readFile).mockRejectedValue(
      fsError('EACCES', 'permission denied')
    );

    const payload = await loadGuide('/work/review.xml', {}, ['src/retry.ts']);

    expect(payload).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0][0]);
    expect(line).toContain('/work/review.guide.xml');
    expect(line).toContain('unreadable');
  });

  it('returns null with exactly one stderr warning for an invalid guide', async () => {
    vi.mocked(readFile).mockResolvedValue('this is not xml at all');

    const payload = await loadGuide('/work/review.xml', {}, ['src/retry.ts']);

    expect(payload).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0][0]);
    expect(line).toContain('/work/review.guide.xml');
    expect(line).toContain('invalid');
  });

  it('returns the reconciled payload for a valid guide', async () => {
    vi.mocked(readFile).mockResolvedValue(VALID_GUIDE_XML);

    const payload = await loadGuide('/work/review.xml', {}, [
      'src/retry.ts',
      'src/unmentioned.ts',
    ]);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(payload).toEqual({
      overview: 'Adds retry logic; start with the wrapper.',
      groups: [
        {
          name: 'Core change',
          rationale: 'The retry wrapper everything else calls.',
          implicit: false,
          files: [
            { path: 'src/retry.ts', description: 'Adds the retry wrapper.' },
          ],
        },
        {
          name: 'Everything else',
          implicit: true,
          files: [{ path: 'src/unmentioned.ts' }],
        },
      ],
    });
  });

  it('reads from the guide-file override path when configured', async () => {
    vi.mocked(readFile).mockResolvedValue(VALID_GUIDE_XML);

    await loadGuide('/work/review.xml', { guideFile: '/custom/guide.xml' }, [
      'src/retry.ts',
    ]);

    expect(vi.mocked(readFile)).toHaveBeenCalledWith(
      '/custom/guide.xml',
      'utf-8'
    );
  });
});
