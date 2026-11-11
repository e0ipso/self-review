import type { BrowserWindow, IpcMain } from 'electron';
import { expect, it, vi } from 'vitest';
const engine = vi.hoisted(() => ({ apply: vi.fn(), expand: vi.fn() }));
vi.mock('../../packages/core/src/review-handlers', async importOriginal => ({
  ...(await importOriginal<typeof import('../../packages/core/src/review-handlers')>()),
  applySuggestionForSession: () => {
    throw new Error('synchronous Apply invoked');
  },
  applySuggestionForSessionAsync: engine.apply,
  expandContext: engine.expand,
}));
import { createReviewSession } from '../../packages/core/src/review-handlers';
import { registerIpcHandlers } from './ipc-handlers';
import { createIpcBoundary } from './ipc-boundary';
import { ReviewTransition } from './review-transition';
import { DesktopOperations } from './desktop-operations';
import { IPC } from '../shared/ipc-channels';
function fixture() {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const register = (channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers[channel] = handler;
  };
  const frame = {};
  const sender = { mainFrame: frame, isDestroyed: () => false };
  const window = { isDestroyed: () => false, webContents: sender } as unknown as BrowserWindow;
  const session = createReviewSession();
  const operations = new DesktopOperations();
  registerIpcHandlers(
    session,
    createIpcBoundary({ on: register, handle: register } as unknown as IpcMain, () => window),
    new ReviewTransition(session),
    {
      pickDirectory: vi.fn(),
      confirmPayload: vi.fn(),
      appInfo: vi.fn(),
      versionUpdate: vi.fn(),
      openExternal: vi.fn(),
    },
    operations
  );
  const request = {
    filePath: 'a.ts',
    lineRange: null,
    suggestion: { originalCode: 'a', proposedCode: 'b' },
  };
  return {
    session,
    operations,
    request,
    expand: (contextLines: number) =>
      handlers[IPC.DIFF_EXPAND_CONTEXT](
        { sender, senderFrame: frame },
        { filePath: 'a.ts', contextLines }
      ) as Promise<unknown>,
    apply: () =>
      handlers[IPC.SUGGESTION_APPLY]({ sender, senderFrame: frame }, request) as Promise<unknown>,
  };
}
it('awaits the async session writer and preserves exact ordinary Error cancellation', async () => {
  const f = fixture();
  const cancel = f.operations.replaceWindow();
  let ready!: () => void;
  const started = new Promise<void>(resolve => {
    ready = resolve;
  });
  engine.apply.mockImplementation((session, request, { signal }: { signal: AbortSignal }) => {
    expect(session).toBe(f.session);
    expect(request).toBe(f.request);
    ready();
    return new Promise((_, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    );
  });
  const applying = f.apply();
  await started;
  const reason = new Error('window closed');
  cancel(reason);
  await expect(applying).rejects.toBe(reason);
});
it('keeps a committed result applied even if the owner aborts before the reply arrives', async () => {
  const f = fixture();
  const cancel = f.operations.replaceWindow();
  const result = { status: 'applied', filePath: 'a.ts', replacedLines: 1 };
  engine.apply.mockImplementation(async () => {
    cancel(new Error('closed after rename'));
    return result;
  });
  await expect(f.apply()).resolves.toBe(result);
  expect(engine.apply).toHaveBeenCalledOnce();
});

it('serializes expansion with Apply and other expansions so late context cannot replace a newer result', async () => {
  const f = fixture();
  let finish!: (value: { hunks: never[]; totalLines: number }) => void;
  engine.expand.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const expanding = f.expand(10);
  await Promise.resolve();
  await expect(f.expand(20)).rejects.toThrow(/already in progress/);
  await expect(f.apply()).rejects.toThrow(/already in progress/);
  expect(engine.expand).toHaveBeenCalledOnce();
  finish({ hunks: [], totalLines: 10 });
  await expect(expanding).resolves.toEqual({ hunks: [], totalLines: 10 });
  engine.expand.mockResolvedValueOnce({ hunks: [], totalLines: 20 });
  await expect(f.expand(20)).resolves.toEqual({ hunks: [], totalLines: 20 });
});
