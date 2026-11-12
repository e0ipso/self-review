import { expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const calls = vi.hoisted(() => ({
  source: vi.fn(),
  load: vi.fn(),
  config: {} as { guideFile?: string },
}));
vi.mock('../../packages/core/src/config', async () => {
  const { DEFAULT_CONFIG } = await import('../../packages/react/src/config-defaults');
  return {
    loadConfigWithProvenance: () => ({
      config: { ...DEFAULT_CONFIG, ...calls.config },
      provenance: Object.fromEntries(Object.keys(DEFAULT_CONFIG).map(key => [key, 'default'])),
      sources: [],
    }),
  };
});
vi.mock('./cli', () => ({ parseCliArgs: () => ({ gitDiffArgs: [] }) }));
vi.mock('./presentation', () => ({ confirmPayload: vi.fn(async () => true) }));
vi.mock('../../packages/core/src/startup-mode', () => ({
  resolveStartupSource: () => {
    throw new Error('synchronous probe invoked');
  },
  resolveStartupSourceAsync: calls.source,
}));
vi.mock('../../packages/core/src/startup', async importOriginal => ({
  ...(await importOriginal<typeof import('../../packages/core/src/startup')>()),
  loadLocalReview: calls.load,
}));
import { initializeSession } from './startup';
import { createDesktopSession } from './desktop-session';
it('uses asynchronous probes and threads the startup owner through the sixth load argument', async () => {
  const desktop = createDesktopSession(process.cwd());
  calls.source.mockResolvedValue({ mode: 'welcome' });
  calls.load.mockResolvedValue({
    payload: { files: [], source: { type: 'welcome' } },
    identity: null,
  });
  const abort = new AbortController();
  await expect(initializeSession(desktop, abort.signal)).resolves.toBe(true);
  expect(calls.source).toHaveBeenCalledWith([], process.cwd(), {
    signal: abort.signal,
    timeoutMs: 30_000,
  });
  expect(calls.load).toHaveBeenCalledWith(
    { mode: 'welcome' },
    [],
    expect.anything(),
    process.cwd(),
    expect.any(Function),
    { signal: abort.signal, timeoutMs: 30_000 }
  );
});
it('does not commit a completed local load after startup cancellation', async () => {
  const desktop = createDesktopSession(process.cwd());
  calls.source.mockResolvedValue({ mode: 'welcome' });
  const abort = new AbortController();
  const reason = new Error('startup expired');
  calls.load.mockImplementation(async () => {
    abort.abort(reason);
    return { payload: { files: [], source: { type: 'welcome' } }, identity: null };
  });
  await expect(initializeSession(desktop, abort.signal)).rejects.toBe(reason);
  expect(desktop.review.diffData).toBeNull();
});

it('loads a configured relative guide from the session launch directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'desktop-guide-cwd-'));
  try {
    calls.config.guideFile = 'orientation.xml';
    await writeFile(
      join(root, 'orientation.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<guide xmlns="urn:self-review-guide:v1"><overview>Session orientation.</overview>
<group name="Source"><rationale>Begin here.</rationale>
<file path="a.ts"><description>Source file.</description></file></group></guide>`
    );
    calls.source.mockResolvedValue({ mode: 'directory', path: root });
    calls.load.mockResolvedValue({
      payload: {
        files: [
          { oldPath: 'a.ts', newPath: 'a.ts', hunks: [], changeType: 'added', isBinary: false },
        ],
        source: { type: 'directory', sourcePath: root },
      },
      identity: null,
    });
    const desktop = createDesktopSession(root);
    await expect(initializeSession(desktop, undefined, async () => true)).resolves.toBe(true);
    expect(desktop.review.guideData?.overview).toBe('Session orientation.');
  } finally {
    delete calls.config.guideFile;
    await rm(root, { recursive: true, force: true });
  }
});
