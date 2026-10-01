import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { publishReview, ReviewPublishError } from './review-publisher';
import type { PublishReviewOptions } from './review-publisher';
import { nodeFsLayer } from './safe-fs';
import type { FsLayer } from './safe-fs';
import type { ReviewComment, ReviewState } from './types';

// The real validator runs here: a publisher test that mocks validation away
// would not prove that the document is checked before anything is written.
// The module is still wrapped so individual tests can make the validator
// fail to load (the documented non-fatal exception).
vi.mock('xmllint-wasm', async importOriginal => {
  const actual = await importOriginal<typeof import('xmllint-wasm')>();
  return { ...actual, validateXML: vi.fn(actual.validateXML) };
});

const ASSETS = '.self-review-assets';
const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

let tmp: string;
let outputPath: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-publish-'));
  outputPath = path.join(tmp, 'review.xml');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  // A read-only directory test leaves the tree unwritable; restore first.
  fs.chmodSync(tmp, 0o755);
  fs.rmSync(tmp, { recursive: true, force: true });
});

function comment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: 'c1',
    filePath: 'src/main.ts',
    lineRange: { side: 'new', start: 1, end: 1 },
    body: 'Looks wrong',
    category: 'bug',
    suggestion: null,
    ...overrides,
  };
}

function review(comments: ReviewComment[] = [comment()], timestamp = '2026-01-01T00:00:00Z') {
  const state: ReviewState = {
    timestamp,
    source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
    files: [{ path: 'src/main.ts', changeType: 'modified', viewed: true, comments }],
  };
  return state;
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function withAttachment(bytes: Uint8Array = PNG): ReviewState {
  return review([
    comment({
      attachments: [
        { id: 'a1', fileName: 'shot.png', mediaType: 'image/png', data: bytes.slice().buffer },
      ],
    }),
  ]);
}

const explicit: PublishReviewOptions = { outputOrigin: 'explicit' };

async function publishError(
  state: ReviewState,
  target: string,
  options: PublishReviewOptions
): Promise<ReviewPublishError> {
  try {
    await publishReview(state, target, options);
  } catch (error) {
    expect(error).toBeInstanceOf(ReviewPublishError);
    return error as ReviewPublishError;
  }
  throw new Error('publishReview resolved; expected it to throw');
}

function listDir(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
}

function assetPathsIn(xml: string): string[] {
  return [...xml.matchAll(/<attachment path="([^"]+)"/g)].map(m => m[1]);
}

/**
 * A filesystem whose writes succeed for `budget` bytes and then fail with
 * ENOSPC after a partial write, the way a full disk fails: some bytes land,
 * the rest do not, and the error carries the errno code.
 */
function enospcAfter(budget: number): FsLayer {
  let remaining = budget;
  return {
    ...nodeFsLayer,
    writeSync(fd, buffer) {
      if (remaining <= 0) throw errno('ENOSPC');
      const slice = buffer.subarray(0, Math.min(buffer.length, remaining));
      const written = nodeFsLayer.writeSync(fd, slice);
      remaining -= written;
      if (written < buffer.length) throw errno('ENOSPC');
      return written;
    },
  };
}

function errno(code: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`${code}: injected`);
  error.code = code;
  return error;
}

/** Publish once so a later attempt has a previous document and asset to protect. */
async function publishPrevious(): Promise<{ xml: string; assetName: string; assetBytes: Buffer }> {
  await publishReview(withAttachment(new Uint8Array([1, 2, 3])), outputPath, explicit);
  const xml = fs.readFileSync(outputPath, 'utf-8');
  const [relative] = assetPathsIn(xml);
  const assetName = path.basename(relative);
  const assetBytes = fs.readFileSync(path.join(tmp, ASSETS, assetName));
  return { xml, assetName, assetBytes };
}

describe('publishReview', () => {
  it('writes the validated document, then its attachments, and reports both paths', async () => {
    const result = await publishReview(withAttachment(), outputPath, explicit);

    const xml = fs.readFileSync(outputPath, 'utf-8');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.endsWith('</review>\n')).toBe(true);

    const [relative] = assetPathsIn(xml);
    expect(relative).toMatch(/^\.self-review-assets\/c1-[0-9a-f]+\.png$/);
    const absolute = path.join(tmp, relative);
    expect(fs.readFileSync(absolute)).toEqual(Buffer.from(PNG));

    expect(result).toEqual({ outputPath, assetPaths: [absolute] });
    // No temp file is left behind on success.
    expect(listDir(tmp)).toEqual([ASSETS, 'review.xml']);
  });

  it('never overwrites an asset the previous document references', async () => {
    const previous = await publishPrevious();

    await publishReview(withAttachment(new Uint8Array([9, 9, 9])), outputPath, explicit);

    const assets = listDir(path.join(tmp, ASSETS));
    expect(assets).toHaveLength(2);
    expect(assets).toContain(previous.assetName);
    expect(fs.readFileSync(path.join(tmp, ASSETS, previous.assetName))).toEqual(
      previous.assetBytes
    );
    const [newRelative] = assetPathsIn(fs.readFileSync(outputPath, 'utf-8'));
    expect(path.basename(newRelative)).not.toBe(previous.assetName);
  });

  it('keeps an attachment that already lives on disk as a path reference', async () => {
    const state = review([
      comment({
        attachments: [{ id: 'a1', fileName: `${ASSETS}/old.png`, mediaType: 'image/png' }],
      }),
    ]);

    const result = await publishReview(state, outputPath, explicit);

    expect(result.assetPaths).toEqual([]);
    expect(fs.readFileSync(outputPath, 'utf-8')).toContain(
      `<attachment path="${ASSETS}/old.png" media-type="image/png" />`
    );
    expect(fs.existsSync(path.join(tmp, ASSETS))).toBe(false);
  });

  it('does not create the asset directory when nothing needs staging', async () => {
    await publishReview(review(), outputPath, explicit);
    expect(listDir(tmp)).toEqual(['review.xml']);
  });

  describe('document refusals write nothing', () => {
    it('names the field holding an XML-illegal character', async () => {
      const state = withAttachment();
      state.files[0].comments[0].body = 'bad \u0001 byte';

      const error = await publishError(state, outputPath, explicit);

      expect(error.code).toBe('xml-illegal-character');
      expect(error.message).toContain('U+0001');
      expect(error.message).toContain('body');
      expect(listDir(tmp)).toEqual([]);
    });

    it('reports schema violations as strings, never as [object Object]', async () => {
      const state = withAttachment();
      state.timestamp = 'yesterday';

      const error = await publishError(state, outputPath, explicit);

      expect(error.code).toBe('validation-failed');
      expect(error.details.length).toBeGreaterThan(0);
      for (const detail of error.details) {
        expect(typeof detail).toBe('string');
        expect(detail).not.toContain('[object Object]');
      }
      expect(error.message).not.toContain('[object Object]');
      expect(error.message).toContain(error.details[0]);
      expect(listDir(tmp)).toEqual([]);
    });

    it('leaves the previous document and assets untouched', async () => {
      const previous = await publishPrevious();
      const state = withAttachment();
      state.timestamp = 'yesterday';

      await publishError(state, outputPath, explicit);

      expect(fs.readFileSync(outputPath, 'utf-8')).toBe(previous.xml);
      expect(listDir(path.join(tmp, ASSETS))).toEqual([previous.assetName]);
    });

    // AGENTS.md "XML must validate, with one stated exception": a validator
    // that cannot load is not fatal, and the warning is the only trace.
    it('still publishes when the validator itself fails to load', async () => {
      const { validateXML } = await import('xmllint-wasm');
      vi.mocked(validateXML).mockRejectedValueOnce(new Error('WASM load failed'));

      await publishReview(review(), outputPath, explicit);

      expect(fs.readFileSync(outputPath, 'utf-8')).toContain('</review>');
      expect(console.error).toHaveBeenCalledWith(
        '[main] XML validation infrastructure failed: WASM load failed - emitting XML without validation'
      );
    });
  });

  describe('filesystem failures', () => {
    it('reports a directory at the output path', async () => {
      fs.mkdirSync(outputPath);

      const error = await publishError(withAttachment(), outputPath, explicit);

      expect(error.code).toBe('output-is-directory');
      expect(error.message).toContain(outputPath);
      expect(listDir(outputPath)).toEqual([]);
      expect(listDir(tmp)).toEqual(['review.xml']);
    });

    it.skipIf(IS_ROOT)('reports a read-only output directory', async () => {
      fs.chmodSync(tmp, 0o555);

      const error = await publishError(review(), outputPath, explicit);

      expect(error.code).toBe('permission-denied');
      expect(error.message).toContain(outputPath);
    });

    it('leaves the previous document byte-identical when the disk fills mid-write', async () => {
      const previous = await publishPrevious();
      const beforeAssets = listDir(path.join(tmp, ASSETS));
      // Enough for the attachment, not for the document.
      const options: PublishReviewOptions = { outputOrigin: 'explicit', fs: enospcAfter(40) };

      const error = await publishError(withAttachment(), outputPath, options);

      expect(error.code).toBe('no-space');
      expect(fs.readFileSync(outputPath, 'utf-8')).toBe(previous.xml);
      expect(fs.readFileSync(path.join(tmp, ASSETS, previous.assetName))).toEqual(
        previous.assetBytes
      );
      // Only this attempt's files are removed: the staged asset and the temp.
      expect(listDir(path.join(tmp, ASSETS))).toEqual(beforeAssets);
      expect(listDir(tmp)).toEqual([ASSETS, 'review.xml']);
    });

    it('removes a partially staged asset when the disk fills during staging', async () => {
      const previous = await publishPrevious();
      const options: PublishReviewOptions = { outputOrigin: 'explicit', fs: enospcAfter(2) };

      const error = await publishError(withAttachment(), outputPath, options);

      expect(error.code).toBe('no-space');
      expect(listDir(path.join(tmp, ASSETS))).toEqual([previous.assetName]);
      expect(fs.readFileSync(outputPath, 'utf-8')).toBe(previous.xml);
    });

    it('refuses an existing output with more than one hard link', async () => {
      const previous = await publishPrevious();
      fs.linkSync(outputPath, path.join(tmp, 'alias.xml'));

      const error = await publishError(review(), outputPath, explicit);

      expect(error.code).toBe('unsupported-target');
      expect(fs.readFileSync(path.join(tmp, 'alias.xml'), 'utf-8')).toBe(previous.xml);
    });
  });

  describe('link policy', () => {
    let outside: string;

    beforeEach(() => {
      outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-outside-'));
    });

    afterEach(() => {
      fs.rmSync(outside, { recursive: true, force: true });
    });

    it('refuses a symlinked asset directory and writes nothing through it', async () => {
      const previous = await publishPrevious();
      fs.rmSync(path.join(tmp, ASSETS), { recursive: true });
      fs.symlinkSync(outside, path.join(tmp, ASSETS));

      const error = await publishError(withAttachment(), outputPath, explicit);

      expect(error.code).toBe('unsafe-link');
      expect(listDir(outside)).toEqual([]);
      expect(fs.readFileSync(outputPath, 'utf-8')).toBe(previous.xml);
    });

    it('refuses a pre-existing link at the staged asset name', async () => {
      const victim = path.join(outside, 'victim.png');
      fs.writeFileSync(victim, 'sentinel');
      fs.mkdirSync(path.join(tmp, ASSETS));
      fs.symlinkSync(victim, path.join(tmp, ASSETS, 'c1-feedface.png'));
      const options: PublishReviewOptions = {
        outputOrigin: 'explicit',
        randomName: () => 'feedface',
      };

      const error = await publishError(withAttachment(), outputPath, options);

      expect(error.code).toBe('unsafe-link');
      expect(fs.readFileSync(victim, 'utf-8')).toBe('sentinel');
      expect(fs.existsSync(outputPath)).toBe(false);
    });

    it('refuses a symlinked output leaf for an inherited path', async () => {
      const victim = path.join(outside, 'victim.xml');
      fs.writeFileSync(victim, 'sentinel');
      fs.symlinkSync(victim, outputPath);

      const error = await publishError(review(), outputPath, {
        outputOrigin: 'inherited',
        baseDir: tmp,
      });

      expect(error.code).toBe('unsafe-link');
      expect(fs.readFileSync(victim, 'utf-8')).toBe('sentinel');
      expect(fs.readlinkSync(outputPath)).toBe(victim);
    });

    it('refuses a symlinked output leaf for an explicit path too', async () => {
      const victim = path.join(outside, 'victim.xml');
      fs.writeFileSync(victim, 'sentinel');
      fs.symlinkSync(victim, outputPath);

      const error = await publishError(review(), outputPath, explicit);

      expect(error.code).toBe('unsafe-link');
      expect(fs.readFileSync(victim, 'utf-8')).toBe('sentinel');
    });

    it('refuses an inherited path that physically resolves outside the base directory', async () => {
      fs.symlinkSync(outside, path.join(tmp, 'linked'));

      const error = await publishError(review(), path.join(tmp, 'linked', 'review.xml'), {
        outputOrigin: 'inherited',
        baseDir: tmp,
      });

      expect(error.code).toBe('unsafe-link');
      expect(listDir(outside)).toEqual([]);
    });

    it('refuses an inherited path lexically outside the base directory', async () => {
      const error = await publishError(review(), path.join(outside, 'review.xml'), {
        outputOrigin: 'inherited',
        baseDir: tmp,
      });

      expect(error.code).toBe('unsafe-link');
      expect(listDir(outside)).toEqual([]);
    });

    it('allows an explicit path outside the project', async () => {
      const target = path.join(outside, 'review.xml');

      await publishReview(review(), target, explicit);

      expect(fs.readFileSync(target, 'utf-8')).toContain('</review>');
    });
  });

  describe('permissions', () => {
    it('preserves the mode of an existing output file', async () => {
      await publishPrevious();
      fs.chmodSync(outputPath, 0o600);

      await publishReview(review(), outputPath, explicit);

      expect(fs.statSync(outputPath).mode & 0o777).toBe(0o600);
      expect(fs.readFileSync(outputPath, 'utf-8')).not.toContain('<attachment');
    });

    it('gives a new output file the umask default rather than the temp file mode', async () => {
      const previousUmask = process.umask(0o022);
      try {
        await publishReview(review(), outputPath, explicit);
      } finally {
        process.umask(previousUmask);
      }

      expect(fs.statSync(outputPath).mode & 0o777).toBe(0o644);
    });
  });
});
