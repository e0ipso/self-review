import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSyntheticFilesAsync, generateSyntheticDiffsAsync } from './synthetic-diff';
import { readSyntheticSourceAsync } from './synthetic-source';

// Control only the completed source read, so cancellation must happen in projection itself.
vi.mock('./synthetic-source', async importOriginal => {
  const actual = await importOriginal<typeof import('./synthetic-source')>();
  return { ...actual, readSyntheticSourceAsync: vi.fn() };
});
afterEach(() => vi.restoreAllMocks());

describe('cooperative single-file projection', () => {
  it('yields while counting before any decoded text or line representation exists', async () => {
    const controller = new AbortController();
    const content = Buffer.from('\n'.repeat(70000));
    const decode = vi.spyOn(content, 'toString');
    vi.mocked(readSyntheticSourceAsync).mockImplementationOnce(async () => {
      setImmediate(() => controller.abort(new Error('stop counting')));
      return { kind: 'text', content, bytesRead: content.length };
    });
    await expect(
      loadSyntheticFilesAsync(['f'], '/unused', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'CommandCancelledError' });
    expect(decode).not.toHaveBeenCalled();
  });

  it.each(['files', 'patch'] as const)(
    'yields during %s emission and cancels before building all lines',
    async output => {
      const controller = new AbortController();
      const content = Buffer.from('x\n'.repeat(20000));
      let emitted = 0;
      let emittedAtAbort = 0;
      const push = Array.prototype.push;
      Array.prototype.push = function (this: unknown[], ...items: unknown[]) {
        for (const item of items) {
          if (
            (output === 'files' &&
              typeof item === 'object' &&
              item !== null &&
              'type' in item &&
              item.type === 'addition') ||
            (output === 'patch' && item === '+x')
          )
            emitted++;
        }
        return push.apply(this, items);
      };
      const decode = content.toString.bind(content);
      vi.spyOn(content, 'toString').mockImplementation(() => {
        setImmediate(() => {
          emittedAtAbort = emitted;
          controller.abort(new Error('stop emission'));
        });
        return decode('utf-8');
      });
      vi.mocked(readSyntheticSourceAsync).mockResolvedValueOnce({
        kind: 'text',
        content,
        bytesRead: content.length,
      });
      const load = output === 'files' ? loadSyntheticFilesAsync : generateSyntheticDiffsAsync;
      try {
        await expect(load(['f'], '/unused', { signal: controller.signal })).rejects.toMatchObject({
          name: 'CommandCancelledError',
        });
      } finally {
        Array.prototype.push = push;
      }
      expect(emittedAtAbort).toBeGreaterThan(0);
      expect(emittedAtAbort).toBeLessThan(20000);
      expect(emitted).toBe(emittedAtAbort);
    }
  );
});
