import { EventEmitter } from 'node:events';
import type { BrowserWindow, IpcMain } from 'electron';
import { afterEach, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc-channels';
import { MAX_FIND_QUERY_LENGTH, MAX_PENDING_FIND_REQUESTS } from '../shared/find-limits';
import { createIpcBoundary } from './ipc-boundary';
import { registerFindHandlers, registerFindInPageForWindow } from './find-in-page';

function fixture(legacy = false) {
  let id = 0;
  let destroyed = false;
  const sender = Object.assign(new EventEmitter(), {
    mainFrame: {},
    isDestroyed: () => destroyed,
    send: vi.fn(),
    findInPage: vi.fn(() => ++id),
    stopFindInPage: vi.fn(),
  });
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: () => destroyed,
    webContents: sender,
  });
  let current: BrowserWindow | null = window as unknown as BrowserWindow;
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const register = (channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers[channel] = handler;
  };
  const boundary = createIpcBoundary(
    { on: register, handle: register } as unknown as IpcMain,
    () => current
  );
  const controller = new AbortController();
  const legacyResult = legacy ? registerFindHandlers(boundary) : undefined;
  const dispose = legacy
    ? () => window.emit('closed')
    : registerFindHandlers(boundary, controller.signal);
  registerFindInPageForWindow(current);
  const peer = { sender, senderFrame: sender.mainFrame };
  const query = (text = 'one', forward = true, findNext = true) =>
    handlers[IPC.FIND_IN_PAGE](peer, { text, forward, findNext });
  const result = (requestId: number, finalUpdate = true, matches = 4) =>
    sender.emit('found-in-page', {}, { requestId, finalUpdate, matches, activeMatchOrdinal: 2 });
  return {
    legacyResult,
    sender,
    window,
    controller,
    dispose,
    handlers,
    peer,
    query,
    result,
    replace: () => {
      current = null;
    },
    destroy: () => {
      destroyed = true;
      sender.emit('destroyed');
    },
  };
}
afterEach(() => vi.useRealTimers());

it('bounds text and validates frame/argv before invoking Chromium while retaining all find flags/actions', () => {
  const f = fixture();
  f.query('x'.repeat(MAX_FIND_QUERY_LENGTH + 1));
  f.handlers[IPC.FIND_IN_PAGE](
    { ...f.peer, senderFrame: {} },
    { text: 'one', forward: true, findNext: true }
  );
  f.handlers[IPC.FIND_IN_PAGE](f.peer, { text: 'one', forward: true, findNext: true }, 'extra');
  expect(f.sender.findInPage).not.toHaveBeenCalled();
  f.query('x'.repeat(MAX_FIND_QUERY_LENGTH), false, true);
  expect(f.sender.findInPage).toHaveBeenCalledExactlyOnceWith('x'.repeat(MAX_FIND_QUERY_LENGTH), {
    forward: false,
    findNext: true,
  });
  for (const action of ['clearSelection', 'keepSelection', 'activateSelection']) {
    f.handlers[IPC.FIND_STOP](f.peer, action);
    expect(f.sender.stopFindInPage).toHaveBeenLastCalledWith(action);
  }
  f.query('');
  expect(f.sender.findInPage).toHaveBeenCalledOnce();
  f.dispose();
});

it('coalesces new queries, suppresses cross-query replies and keeps each normal navigation step in order', () => {
  const f = fixture();
  f.query('one');
  f.query('two');
  f.query('three');
  f.query('three', false, false);
  f.query('three', true, false);
  expect(f.sender.findInPage).toHaveBeenCalledTimes(1);
  f.result(900);
  f.result(1, false);
  expect(f.sender.send).not.toHaveBeenCalled();
  f.result(1);
  expect(f.sender.findInPage.mock.calls).toEqual([
    ['one', { forward: true, findNext: true }],
    ['three', { forward: true, findNext: true }],
  ]);
  f.result(1); // A late duplicate cannot finish the next request.
  expect(f.sender.findInPage).toHaveBeenCalledTimes(2);
  f.result(2, false);
  expect(f.sender.send).toHaveBeenLastCalledWith(IPC.FIND_RESULT, {
    activeMatchOrdinal: 2,
    matches: 4,
    finalUpdate: false,
  });
  f.result(2);
  f.result(3);
  f.result(4);
  expect(f.sender.findInPage.mock.calls.slice(2)).toEqual([
    ['three', { forward: false, findNext: false }],
    ['three', { forward: true, findNext: false }],
  ]);
  f.dispose();
});

it('caps navigation admission without losing admitted steps or growing native listeners', () => {
  const f = fixture();
  f.query();
  for (let i = 0; i < MAX_PENDING_FIND_REQUESTS + 7; i++) f.query('one', i % 2 === 0, false);
  expect(f.sender.findInPage).toHaveBeenCalledOnce();
  expect(f.sender.listenerCount('found-in-page')).toBe(1);
  for (let i = 1; i <= MAX_PENDING_FIND_REQUESTS; i++) f.result(i);
  expect(f.sender.findInPage).toHaveBeenCalledTimes(MAX_PENDING_FIND_REQUESTS);
  f.query('one', false, false);
  expect(f.sender.findInPage).toHaveBeenCalledTimes(MAX_PENDING_FIND_REQUESTS + 1);
  f.dispose();
  expect(f.sender.eventNames()).toEqual([]);
  expect(f.window.eventNames()).toEqual([]);
});

it.each([
  'stop',
  'empty',
  'navigation',
  'destroy',
  'closed',
  'crash',
  'dispose',
  'abort',
  'replacement',
  'timeout',
] as const)('clears native admission and drops queued/late replies on %s', async kind => {
  vi.useFakeTimers();
  const f = fixture();
  f.query();
  f.query('two');
  const late = f.sender.listeners('found-in-page')[0];
  if (kind === 'stop') f.handlers[IPC.FIND_STOP](f.peer, 'keepSelection');
  if (kind === 'empty') f.query('');
  if (kind === 'navigation') f.sender.emit('did-start-navigation', {}, '/new', false, true);
  if (kind === 'destroy') f.destroy();
  if (kind === 'closed') f.window.emit('closed');
  if (kind === 'crash') f.sender.emit('render-process-gone');
  if (kind === 'dispose') f.dispose();
  if (kind === 'abort') f.controller.abort();
  if (kind === 'replacement') f.replace();
  if (kind === 'timeout') await vi.advanceTimersByTimeAsync(30_000);
  late({}, { requestId: 1, finalUpdate: true, matches: 3, activeMatchOrdinal: 1 });
  expect(f.sender.send).not.toHaveBeenCalled();
  expect(f.sender.findInPage).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  if (!['destroy', 'closed', 'dispose', 'abort', 'replacement'].includes(kind)) {
    f.query('fresh');
    expect(f.sender.findInPage).toHaveBeenCalledTimes(2);
  }
  f.dispose();
  expect(f.sender.eventNames()).toEqual([]);
});

it('ignores subframe navigation and cleans synchronous native failure before accepting another request', () => {
  const f = fixture();
  f.sender.findInPage.mockImplementationOnce(() => {
    throw new Error('native failure');
  });
  expect(() => f.query()).not.toThrow();
  f.query('fresh');
  f.sender.emit('did-start-navigation', {}, '/frame', false, false);
  f.result(1);
  expect(f.sender.send).toHaveBeenCalledOnce();
  f.dispose();
});

it('retains the one-argument registration call and its void result', () => {
  const f = fixture(true);
  expect(f.legacyResult).toBeUndefined();
  f.query('legacy');
  f.result(1);
  expect(f.sender.send).toHaveBeenCalledOnce();
  f.dispose();
});
