import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  inspectOutputPathAsync,
  ReviewPublishError,
} from '../../packages/core/src/review-publisher';
import { IPC } from '../shared/ipc-channels';
import { createDesktopSession } from './desktop-session';
import { createIpcBoundary } from './ipc-boundary';
import { registerOutputSelection } from './output-selection';
import { defaultStartupOperations } from './startup-operations';
import type { QuitPhase } from './quit-controller';

vi.mock('../../packages/core/src/review-publisher', async importOriginal => ({
  ...(await importOriginal<typeof import('../../packages/core/src/review-publisher')>()),
  inspectOutputPath: vi.fn(() => null),
  inspectOutputPathAsync: vi.fn(),
}));
const releases: (() => void)[] = [];
function deferred() {
  let resolve!: (problem: ReviewPublishError | null) => void;
  const promise = new Promise<ReviewPublishError | null>(yes => {
    resolve = yes;
  });
  releases.push(() => resolve(null));
  return { promise, resolve };
}
beforeEach(() => vi.mocked(inspectOutputPathAsync).mockReset());
afterEach(async () => {
  releases.splice(0).forEach(release => release());
  await Promise.resolve();
  vi.restoreAllMocks();
});
function fixture() {
  const handlers = new Map<string, (event: IpcMainInvokeEvent) => unknown>();
  const ipc = {
    handle: (name: string, run: (event: IpcMainInvokeEvent) => unknown) => handlers.set(name, run),
    on: vi.fn(),
  } as unknown as Pick<IpcMain, 'handle' | 'on'>;
  const sender = { mainFrame: {}, isDestroyed: () => false, send: vi.fn() };
  const event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  let window = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  const desktop = createDesktopSession('/launch');
  const phase = { phase: 'reviewing' as QuitPhase };
  const pick = vi.fn(async () => '/selected/review.xml');
  registerOutputSelection(
    desktop,
    createIpcBoundary(ipc, () => window),
    phase,
    { pickOutputPath: pick }
  );
  return {
    desktop,
    phase,
    pick,
    send: sender.send,
    replace: () => {
      window = { ...window } as BrowserWindow;
    },
    request: () => Promise.resolve(handlers.get(IPC.OUTPUT_PATH_CHANGE)!(event)),
  };
}

it('retains the previous output until inspection completes, then publishes matching information', async () => {
  const f = fixture();
  const previous = f.desktop.output;
  const gate = deferred();
  vi.mocked(inspectOutputPathAsync).mockReturnValue(gate.promise);
  const pending = f.request();
  await vi.waitFor(() => expect(inspectOutputPathAsync).toHaveBeenCalledOnce());
  expect(f.desktop.output).toBe(previous);
  expect(f.send).not.toHaveBeenCalled();
  gate.resolve(null);
  const info = await pending;
  expect(f.desktop.output).toEqual({ path: '/selected/review.xml', origin: 'explicit' });
  expect(info).toEqual({ resolvedOutputPath: '/selected/review.xml', outputPathWritable: true });
  expect(f.desktop.review.outputPathInfo).toBe(info);
  expect(f.send).toHaveBeenCalledWith(IPC.OUTPUT_PATH_CHANGED, info);
});

it.each(['source', 'phase', 'peer', 'other output'])(
  'rejects an outdated inspection after changing %s',
  async change => {
    const f = fixture();
    const gate = deferred();
    vi.mocked(inspectOutputPathAsync).mockReturnValue(gate.promise);
    const observed = f.request().then(
      value => ({ value }),
      (error: unknown) => ({ error })
    );
    await vi.waitFor(() => expect(inspectOutputPathAsync).toHaveBeenCalledOnce());
    if (change === 'source') f.desktop.review.diffData = { files: [], source: { type: 'welcome' } };
    else if (change === 'phase') f.phase.phase = 'saving';
    else if (change === 'peer') f.replace();
    else f.desktop.output = { path: '/other/review.xml', origin: 'explicit' };
    const current = f.desktop.output;
    gate.resolve(null);
    const outcome = await observed;
    if (change === 'peer') expect(outcome).toHaveProperty('error');
    else expect(outcome).toEqual({ value: null });
    expect(f.desktop.output).toBe(current);
    expect(f.send).not.toHaveBeenCalled();
  }
);

it('retains cancellation ownership until the native inspection settles', async () => {
  const f = fixture();
  const previous = f.desktop.output;
  const retire = f.desktop.operations.replaceWindow();
  const gate = deferred();
  vi.mocked(inspectOutputPathAsync).mockReturnValue(gate.promise);
  const observed = f.request().then(
    value => ({ value }),
    (error: unknown) => ({ error })
  );
  await vi.waitFor(() => expect(inspectOutputPathAsync).toHaveBeenCalledOnce());
  const reason = new Error('window replaced');
  retire(reason);
  let drained = false;
  const draining = f.desktop.operations.settleForExit().then(() => {
    drained = true;
  });
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(drained).toBe(false);
  expect(f.desktop.output).toBe(previous);
  gate.resolve(null);
  expect(await observed).toEqual({ error: reason });
  await draining;
  expect(f.desktop.output).toBe(previous);
  expect(f.send).not.toHaveBeenCalled();
});

it('keeps the latest choice when an older inspection completes last', async () => {
  const f = fixture();
  const firstGate = deferred();
  const secondGate = deferred();
  f.pick.mockResolvedValueOnce('/first.xml').mockResolvedValueOnce('/second.xml');
  vi.mocked(inspectOutputPathAsync)
    .mockReturnValueOnce(firstGate.promise)
    .mockReturnValueOnce(secondGate.promise);
  const first = f.request();
  await vi.waitFor(() => expect(inspectOutputPathAsync).toHaveBeenCalledTimes(1));
  const second = f.request();
  await vi.waitFor(() => expect(inspectOutputPathAsync).toHaveBeenCalledTimes(2));
  secondGate.resolve(null);
  await second;
  firstGate.resolve(null);
  expect(await first).toBeNull();
  expect(f.desktop.output.path).toBe('/second.xml');
  expect(f.send).toHaveBeenCalledOnce();
});

it('retains advisory permission refusals for the selected output', async () => {
  const f = fixture();
  const problem = new ReviewPublishError(
    'permission-denied',
    '/selected/review.xml',
    'not writable'
  );
  vi.mocked(inspectOutputPathAsync).mockResolvedValue(problem);
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(f.request()).resolves.toEqual({
    resolvedOutputPath: '/selected/review.xml',
    outputPathWritable: false,
  });
  expect(log).toHaveBeenCalledWith('[main] Output path check (permission-denied): not writable');
});

it('binds default startup to the asynchronous inspector without changing supplied inspection roles', async () => {
  vi.mocked(inspectOutputPathAsync).mockResolvedValue(null);
  const output = { path: '/launch/review.xml', origin: 'inherited' as const, baseDir: '/launch' };
  await expect(defaultStartupOperations.inspectOutput!(output, new Map())).resolves.toBeNull();
  expect(inspectOutputPathAsync).toHaveBeenCalledWith(output.path, {
    outputOrigin: 'inherited',
    baseDir: '/launch',
    signal: undefined,
  });
});
