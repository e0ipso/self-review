import { mkdtemp, open, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadGuide } from './guide-loader';
import type { AsyncBoundedReadOptions, BoundedReadResult } from './bounded-read';
import { READ_FLAGS, readDescriptorWithinBudget, readFileWithinBudget } from './bounded-read';
import { MAX_GUIDE_BYTES } from './input-budgets';

const xml = (overview: string) =>
  `<guide xmlns="urn:self-review-guide:v1"><overview>${overview}</overview></guide>`;
const errno = (code: string) => Object.assign(new Error(code), { code });

// A method-based provider catches accidental receiver loss as well as native fallback.
class GuideSource {
  calls: { path: string; maxBytes: number; signal?: AbortSignal }[] = [];
  constructor(readonly answer: BoundedReadResult | Error) {}
  async read(path: string, maxBytes: number, options: AsyncBoundedReadOptions = {}) {
    this.calls.push({ path, maxBytes, signal: options.signal });
    if (this.answer instanceof Error) throw this.answer;
    return this.answer;
  }
}

describe('per-operation guide readers', () => {
  const directories: string[] = [];
  afterEach(async () => {
    for (const directory of directories.splice(0)) await rm(directory, { recursive: true });
  });

  it('uses virtual guide bytes and retains the reader receiver', async () => {
    const reader = new GuideSource({ kind: 'ok', content: Buffer.from(xml('Virtual source')) });
    const reportDiagnostic = vi.fn();
    const guide = await loadGuide('/virtual/review.xml', { guideFile: 'guide.xml' }, ['a.ts'], {
      cwd: '/virtual/project',
      reader,
      reportDiagnostic,
    });
    expect(guide).toEqual({
      overview: 'Virtual source',
      groups: [{ name: 'Everything else', implicit: true, files: [{ path: 'a.ts' }] }],
    });
    expect(reader.calls).toEqual([
      { path: '/virtual/project/guide.xml', maxBytes: MAX_GUIDE_BYTES, signal: undefined },
    ]);
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it.each(['ENOENT', 'EACCES'])(
    'never falls back to an existing native guide after %s',
    async code => {
      const directory = await mkdtemp(join(tmpdir(), 'guide-effects-'));
      directories.push(directory);
      await writeFile(join(directory, 'review.guide.xml'), xml('Native source'));
      const reader = new GuideSource(errno(code));
      const reportDiagnostic = vi.fn();
      expect(
        await loadGuide(join(directory, 'review.xml'), {}, [], { reader, reportDiagnostic })
      ).toBeNull();
      expect(reader.calls).toHaveLength(1);
      if (code === 'ENOENT') expect(reportDiagnostic).not.toHaveBeenCalled();
      else
        expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
          `[guide] Ignoring guide at ${join(directory, 'review.guide.xml')}: unreadable (EACCES)`
        );
    }
  );

  it.each([
    { kind: 'not-regular' as const },
    { kind: 'too-large' as const, size: MAX_GUIDE_BYTES + 1 },
    { kind: 'ok' as const, content: Buffer.from('invalid xml') },
    {
      kind: 'ok' as const,
      content: Buffer.from('<guide xmlns="urn:self-review-guide:v1"><unexpected/></guide>'),
    },
    { kind: 'ok' as const, content: Buffer.from(xml('Oversize') + ' '.repeat(MAX_GUIDE_BYTES)) },
  ])('preserves validation and byte gates for supplied results: $kind', async answer => {
    const reader = new GuideSource(answer);
    const reportDiagnostic = vi.fn();
    expect(await loadGuide('/virtual/review.xml', {}, [], { reader, reportDiagnostic })).toBeNull();
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic.mock.calls[0][0]).toContain(
      answer.kind === 'not-regular'
        ? 'not a regular file'
        : answer.kind === 'too-large' ||
            (answer.kind === 'ok' && answer.content.length > MAX_GUIDE_BYTES)
          ? 'too large'
          : 'invalid'
    );
  });

  it('keeps concurrent readers, signals, cleanup and diagnostics owned by each call', async () => {
    const controller = new AbortController();
    const reason = new Error('Startup cancelled');
    let complete!: () => void;
    let entered!: () => void;
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    const pending = new Promise<void>(resolve => {
      complete = resolve;
    });
    const reader = {
      closed: false,
      async read(
        _path: string,
        maxBytes: number,
        options?: AsyncBoundedReadOptions
      ): Promise<BoundedReadResult> {
        expect(maxBytes).toBe(MAX_GUIDE_BYTES);
        expect(options?.signal).toBe(controller.signal);
        try {
          entered();
          await pending;
          return { kind: 'ok', content: Buffer.from(xml('Obsolete')) };
        } finally {
          this.closed = true;
        }
      },
    };
    const cancelledReport = vi.fn();
    const cancelled = loadGuide('/cancelled/review.xml', {}, [], {
      reader,
      signal: controller.signal,
      reportDiagnostic: cancelledReport,
    });
    const failure = cancelled.catch((error: unknown) => error);
    // Fail promptly if the supplied reader was ignored instead of waiting on an unused gate.
    await Promise.race([started, cancelled]);
    expect(reader.closed).toBe(false);
    controller.abort(reason);
    expect(reader.closed).toBe(false);
    const otherReport = vi.fn();
    const otherReader = new GuideSource(errno('EACCES'));
    expect(
      await loadGuide('/other/review.xml', {}, [], {
        reader: otherReader,
        reportDiagnostic: otherReport,
      })
    ).toBeNull();
    expect(otherReport).toHaveBeenCalledExactlyOnceWith(
      '[guide] Ignoring guide at /other/review.guide.xml: unreadable (EACCES)'
    );
    complete();
    expect(await failure).toBe(reason);
    expect(reader.closed).toBe(true);
    expect(cancelledReport).not.toHaveBeenCalled();
  });

  it('does not call an injected reader for an already aborted operation', async () => {
    const controller = new AbortController();
    controller.abort();
    const reader = new GuideSource(errno('EACCES'));
    const reportDiagnostic = vi.fn();
    await expect(
      loadGuide('/virtual/review.xml', {}, [], {
        reader,
        reportDiagnostic,
        signal: controller.signal,
      })
    ).rejects.toBe(controller.signal.reason);
    expect(reader.calls).toHaveLength(0);
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it('retains native bounded reading as the default', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'guide-native-'));
    directories.push(directory);
    await writeFile(join(directory, 'review.guide.xml'), xml('Default source'));
    expect(await loadGuide(join(directory, 'review.xml'), {}, [])).toMatchObject({
      overview: 'Default source',
    });
    const reader = { read: readFileWithinBudget };
    expect(await loadGuide(join(directory, 'review.xml'), {}, [], { reader })).toMatchObject({
      overview: 'Default source',
    });
  });

  it('detects growth through the bounded reader and closes its real descriptor', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'guide-growth-'));
    directories.push(directory);
    const guidePath = join(directory, 'review.guide.xml');
    await writeFile(guidePath, xml('Initial source'));
    let opened!: Awaited<ReturnType<typeof open>>;
    const reader = {
      async read(target: string, maxBytes: number, options?: AsyncBoundedReadOptions) {
        const handle = await open(target, READ_FLAGS);
        opened = handle;
        try {
          const before = await handle.stat();
          // Simulate replacement bytes arriving after fstat, without patching any module.
          await writeFile(target, xml('Grown source') + ' '.repeat(maxBytes));
          return await readDescriptorWithinBudget(handle.fd, before, maxBytes, options);
        } finally {
          await handle.close();
        }
      },
    };
    const reportDiagnostic = vi.fn();
    expect(
      await loadGuide(join(directory, 'review.xml'), {}, [], { reader, reportDiagnostic })
    ).toBeNull();
    expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('too large'));
    expect(opened.fd).toBe(-1);
  });
});
