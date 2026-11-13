import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserWindow, IpcMain } from 'electron';
import { expect, it, vi } from 'vitest';
import { createDesktopSession } from './desktop-session';
import { createIpcBoundary } from './ipc-boundary';
import { registerSuggestionHandlers } from './suggestion-ipc';
import { bindDesktopReviewOperations } from './review-operations';
import { commitDiffData } from '../../packages/core/src/review-handlers';
import { resolveLocalSourceIdentity } from '../../packages/core/src/source-identity';
import { MAX_SOURCE_FILE_BYTES } from '../../packages/core/src/input-budgets';
import { IPC } from '../shared/ipc-channels';

it('applies a maximum-size original and replacement through the real bounded IPC writer', async () => {
  const root = await mkdtemp(join(tmpdir(), 'desktop-apply-limit-'));
  try {
    const originalCode = 'a'.repeat(MAX_SOURCE_FILE_BYTES);
    const proposedCode = 'b'.repeat(MAX_SOURCE_FILE_BYTES);
    await writeFile(join(root, 'a.txt'), originalCode);
    const desktop = createDesktopSession(root);
    const source = { type: 'directory' as const, sourcePath: root };
    commitDiffData(
      desktop.review,
      {
        source,
        files: [
          {
            oldPath: 'a.txt',
            newPath: 'a.txt',
            changeType: 'modified',
            isBinary: false,
            hunks: [],
          },
        ],
      },
      resolveLocalSourceIdentity(source)
    );
    const commands: Record<string, (...args: unknown[]) => unknown> = {};
    const register = (channel: string, run: (...args: unknown[]) => unknown) => {
      commands[channel] = run;
    };
    const sender = { mainFrame: {}, isDestroyed: () => false };
    const window = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
    const boundary = createIpcBoundary(
      { on: register, handle: register } as unknown as IpcMain,
      () => window
    );
    registerSuggestionHandlers(
      bindDesktopReviewOperations(desktop.review),
      boundary,
      desktop.operations,
      { pickDirectory: vi.fn() }
    );
    const result = await commands[IPC.SUGGESTION_APPLY](
      { sender, senderFrame: sender.mainFrame },
      {
        filePath: 'a.txt',
        lineRange: { side: 'new', start: 1, end: 1 },
        suggestion: { originalCode, proposedCode, extension: 'kept' },
        extension: ['kept'],
      }
    );
    expect(result).toEqual({ status: 'applied', filePath: 'a.txt', replacedLines: 1 });
    expect(await readFile(join(root, 'a.txt'), 'utf8')).toBe(proposedCode);
    expect(await readdir(root)).toEqual(['a.txt']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
