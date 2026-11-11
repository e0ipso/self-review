import { describe, it, expect, vi } from 'vitest';
import type { BrowserWindow, IpcMain, IpcMainEvent } from 'electron';
import {
  createIpcBoundary,
  noArgument,
  findRequest,
  findAction,
  reviewState,
  expansionRequest,
  suggestionRequest,
} from './ipc-boundary';

function fixture() {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const register = (name: string, run: (...args: unknown[]) => unknown) => {
    handlers[name] = run;
  };
  const ipc = { on: register, handle: register } as unknown as IpcMain;
  const mainFrame = {};
  const sender = { mainFrame, isDestroyed: () => false };
  let window = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow | null;
  const boundary = createIpcBoundary(ipc, () => window);
  return {
    boundary,
    handlers,
    peer: { sender, senderFrame: mainFrame },
    replace: () => {
      window = null;
    },
  };
}

describe('desktop IPC boundary', () => {
  it('authenticates every event and invocation before performing effects', () => {
    const { boundary, handlers, peer, replace } = fixture();
    const effect = vi.fn();
    boundary.on('event', noArgument, effect);
    boundary.handle('call', noArgument, effect);
    for (const untrusted of [{}, { ...peer, senderFrame: {} }, { ...peer, sender: {} }]) {
      expect(() => handlers.event(untrusted)).not.toThrow();
      expect(() => handlers.call(untrusted)).toThrow(/main frame/);
    }
    expect(effect).not.toHaveBeenCalled();
    handlers.event(peer);
    handlers.call(peer);
    expect(effect).toHaveBeenCalledTimes(2);
    const assertCurrent = boundary.capture(peer as IpcMainEvent);
    replace();
    expect(assertCurrent).toThrow();
  });

  it.each([null, {}, { text: 3 }, { text: 'a', forward: 'true' }, { text: 'a', findNext: 1 }])(
    'contains malformed find events: %j',
    value => {
      const { boundary, handlers, peer } = fixture();
      const find = vi.fn();
      boundary.on('find', findRequest, find);
      expect(() => handlers.find(peer, value)).not.toThrow();
      expect(find).not.toHaveBeenCalled();
    }
  );

  it('contains synchronous and asynchronous event failures', async () => {
    const { boundary, handlers, peer } = fixture();
    boundary.on('sync', noArgument, () => {
      throw new Error('native failure');
    });
    boundary.on('async', noArgument, async () => {
      throw new Error('native failure');
    });
    expect(() => handlers.sync(peer)).not.toThrow();
    handlers.async(peer);
    await Promise.resolve();
  });

  it('validates enum, nested request and numeric inputs while retaining extensions', () => {
    expect(() => findAction('bad')).toThrow();
    for (const contextLines of [-1, 0.5, Infinity, '10', null])
      expect(() => expansionRequest({ filePath: 'a', contextLines })).toThrow();
    for (const value of [
      null,
      {},
      { filePath: 'a', lineRange: null },
      { filePath: 'a', lineRange: { side: 'bad', start: 1, end: 1 } },
    ])
      expect(() => suggestionRequest(value)).toThrow();
    const valid = { text: '', forward: false, findNext: true, extension: 'keep' };
    expect(findRequest(valid)).toBe(valid);
    expect(findAction('keepSelection')).toBe('keepSelection');
  });

  it('rejects invalid nested review state without replacing the previous valid submission', () => {
    const { boundary, handlers, peer } = fixture();
    let submitted: unknown;
    boundary.on('submit', reviewState, (_event, value) => {
      submitted = value;
    });
    const valid = { timestamp: 'now', source: { type: 'welcome' }, files: [], extension: true };
    handlers.submit(peer, valid);
    for (const value of [
      null,
      {},
      { ...valid, files: [{ path: 'a', changeType: 'added', viewed: true, comments: [{}] }] },
    ])
      handlers.submit(peer, value);
    expect(submitted).toBe(valid);
  });
});

it('uses the shared maximum context bound and retains numeric anchor refusals and extensions', () => {
  for (const contextLines of [0, 99_999])
    expect(expansionRequest({ filePath: 'a', contextLines }).contextLines).toBe(contextLines);
  expect(() => expansionRequest({ filePath: 'a', contextLines: 100_000 })).toThrow();
  for (const start of [0, -1, 1.5, NaN, Infinity]) {
    const value = {
      filePath: 'a',
      lineRange: { side: 'new', start, end: 1, extension: true },
      suggestion: { originalCode: 'a', proposedCode: 'b', extension: true },
      extension: true,
    };
    expect(suggestionRequest(value)).toBe(value);
  }
  expect(() =>
    suggestionRequest({
      filePath: 'a',
      lineRange: [],
      suggestion: { originalCode: 'a', proposedCode: 'b' },
    })
  ).toThrow();
});
