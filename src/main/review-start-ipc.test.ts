import { mkdtemp, mkdir, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMain } from 'electron';
import { createReviewSession } from '../../packages/core/src/review-handlers';
import { DEFAULT_CONFIG } from '../../packages/react/src/config-defaults';
import { registerIpcHandlers } from './ipc-handlers';
import { createIpcBoundary } from './ipc-boundary';
import { ReviewTransition } from './review-transition';
import { IPC } from '../shared/ipc-channels';
import type { ReviewPresentation } from './presentation';

function fixture() {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const register = (name: string, callback: (...args: unknown[]) => unknown) => {
    handlers[name] = callback;
  };
  const ipc = { on: register, handle: register } as unknown as IpcMain;
  const frame = {};
  const sender = { mainFrame: frame, isDestroyed: () => false, send: vi.fn() };
  const window = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  const session = createReviewSession();
  session.diffData = { source: { type: 'welcome' }, files: [] };
  session.config = { ...DEFAULT_CONFIG, ignore: [] };
  const presentation: ReviewPresentation = {
    pickDirectory: vi.fn(async () => null),
    confirmPayload: vi.fn(async () => true),
    appInfo: vi.fn(),
    versionUpdate: vi.fn(),
    openExternal: vi.fn(),
  };
  registerIpcHandlers(
    session,
    createIpcBoundary(ipc, () => window),
    new ReviewTransition(session),
    presentation
  );
  return {
    session,
    sender,
    presentation,
    invoke: async (channel: string, ...args: unknown[]) =>
      handlers[channel]({ sender, senderFrame: frame }, ...args),
  };
}

it('refuses forged directory/file starts before authorizing membership or Apply', async () => {
  const { session, invoke, presentation } = fixture();
  const root = await mkdtemp(join(tmpdir(), 'desktop-start-'));
  try {
    const file = join(root, 'secret.ts');
    await writeFile(file, 'secret\n');
    for (const source of [root, file])
      await expect(invoke(IPC.REVIEW_START_DIRECTORY, source)).rejects.toThrow(/Browse/);
    expect(session.reviewedPaths.size).toBe(0);
    expect(session.diffData?.source.type).toBe('welcome');
    expect(presentation.confirmPayload).not.toHaveBeenCalled();
    expect(
      await invoke(IPC.SUGGESTION_APPLY, {
        filePath: 'secret.ts',
        lineRange: { side: 'new', start: 1, end: 1 },
        suggestion: { originalCode: 'secret', proposedCode: 'changed' },
      })
    ).toMatchObject({ status: 'refused' });
    expect(await readFile(file, 'utf8')).toBe('secret\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('supports native selection, cancelled confirmation, retry and one successful welcome transition', async () => {
  const { session, invoke, presentation, sender } = fixture();
  const root = await mkdtemp(join(tmpdir(), 'desktop-start-'));
  try {
    await writeFile(join(root, 'a.ts'), 'hello\n');
    vi.mocked(presentation.pickDirectory).mockResolvedValue(root);
    expect(await invoke(IPC.DIALOG_PICK_DIRECTORY)).toBe(root);
    vi.mocked(presentation.confirmPayload).mockResolvedValueOnce(false);
    await invoke(IPC.REVIEW_START_DIRECTORY, root);
    expect(session.diffData?.source.type).toBe('welcome');
    expect(session.reviewedPaths.size).toBe(0);
    await invoke(IPC.REVIEW_START_DIRECTORY, root);
    expect(session.reviewedPaths.has('a.ts')).toBe(true);
    expect(sender.send).toHaveBeenCalledWith(
      IPC.DIFF_LOAD,
      expect.objectContaining({ source: { type: 'directory', sourcePath: root } })
    );
    await expect(invoke(IPC.REVIEW_START_DIRECTORY, root)).rejects.toThrow(/already open/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each([
  [null, 'no-anchor'],
  [{ side: 'new', start: 0, end: 1 }, 'invalid-anchor'],
] as const)('returns the core %s anchor refusal as %s', async (lineRange, reason) => {
  const { invoke, presentation } = fixture();
  const root = await mkdtemp(join(tmpdir(), 'desktop-apply-anchor-'));
  try {
    const file = join(root, 'a.ts');
    await writeFile(file, 'hello\n');
    vi.mocked(presentation.pickDirectory).mockResolvedValue(root);
    await invoke(IPC.DIALOG_PICK_DIRECTORY);
    await invoke(IPC.REVIEW_START_DIRECTORY, root);
    await expect(
      invoke(IPC.SUGGESTION_APPLY, {
        filePath: 'a.ts',
        lineRange,
        suggestion: { originalCode: 'hello', proposedCode: 'changed' },
      })
    ).resolves.toMatchObject({ status: 'refused', filePath: 'a.ts', reason });
    expect(await readFile(file, 'utf8')).toBe('hello\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('does not commit a directory scan after its pending confirmation changes session', async () => {
  const { session, invoke, presentation } = fixture();
  const root = await mkdtemp(join(tmpdir(), 'desktop-start-'));
  try {
    await mkdir(join(root, 'empty'));
    vi.mocked(presentation.pickDirectory).mockResolvedValue(root);
    await invoke(IPC.DIALOG_PICK_DIRECTORY);
    vi.mocked(presentation.confirmPayload).mockImplementation(async () => {
      session.diffData = {
        source: { type: 'directory', sourcePath: '/another-review' },
        files: [],
      };
      return true;
    });
    await expect(invoke(IPC.REVIEW_START_DIRECTORY, root)).rejects.toThrow(/session has changed/);
    expect(session.diffData?.source).toEqual({ type: 'directory', sourcePath: '/another-review' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('answers cached update requests after startup completion', async () => {
  const { invoke, presentation, sender } = fixture();
  const update = {
    latestVersion: '3.0.0',
    releaseUrl: 'https://github.com/e0ipso/self-review/releases',
  };
  vi.mocked(presentation.versionUpdate).mockReturnValue(null);
  await invoke(IPC.VERSION_UPDATE_REQUEST);
  expect(sender.send).not.toHaveBeenCalled();
  vi.mocked(presentation.versionUpdate).mockReturnValue(update);
  await invoke(IPC.VERSION_UPDATE_REQUEST);
  expect(sender.send).toHaveBeenCalledWith(IPC.VERSION_UPDATE_AVAILABLE, update);
});

it('rejects a directory replaced while its confirmation was pending', async () => {
  const { session, invoke, presentation } = fixture();
  const root = await mkdtemp(join(tmpdir(), 'desktop-start-'));
  try {
    const directory = join(root, 'picked');
    await mkdir(directory);
    await writeFile(join(directory, 'a.ts'), 'hello\n');
    vi.mocked(presentation.pickDirectory).mockResolvedValue(directory);
    await invoke(IPC.DIALOG_PICK_DIRECTORY);
    vi.mocked(presentation.confirmPayload).mockImplementation(async () => {
      // Retain the original inode at another name so recreation cannot reuse it.
      const { rename } = await import('fs/promises');
      await rename(directory, join(root, 'old'));
      await mkdir(directory);
      return true;
    });
    await expect(invoke(IPC.REVIEW_START_DIRECTORY, directory)).rejects.toThrow(
      /selected directory has changed/
    );
    expect(session.diffData?.source.type).toBe('welcome');
    expect(session.reviewedPaths.size).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('acknowledges an absent initial resume using the existing empty payload', async () => {
  const { invoke, sender } = fixture();
  await invoke(IPC.RESUME_REQUEST);
  await vi.waitFor(() =>
    expect(sender.send).toHaveBeenCalledWith(IPC.RESUME_LOAD, { comments: [], viewedFiles: [] })
  );
});
