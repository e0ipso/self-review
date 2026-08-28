// Tests for the serve-mode configuration adapter.
//
// Only the two behaviours that would not fail loudly are covered: that a
// refused `/api/config` throws rather than silently mounting the UI on default
// configuration, and that the output path info travels alongside the config.
// Everything else in the module is one `fetch` and one `res.json()`.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadServeConfig } from './config-adapter';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Partial<Response>): void {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response as Response)));
}

describe('loadServeConfig', () => {
  it('returns the config and the output path info the route sent', async () => {
    stubFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          config: { theme: 'dark' },
          outputPathInfo: { resolvedOutputPath: '/repo/review.xml', outputPathWritable: true },
          outputPathReadOnly: true,
        }),
    });

    const result = await loadServeConfig();

    expect(result.config).toEqual({ theme: 'dark' });
    expect(result.outputPathInfo).toEqual({
      resolvedOutputPath: '/repo/review.xml',
      outputPathWritable: true,
    });
  });

  it("throws with the server's own message when the route refuses", async () => {
    stubFetch({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Configuration was not resolved at startup' }),
    });

    await expect(loadServeConfig()).rejects.toThrow(
      'Configuration was not resolved at startup'
    );
  });
});
