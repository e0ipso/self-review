import type { BrowserWindow, WebContents, IpcMainEvent } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { MAX_PENDING_FIND_REQUESTS } from '../shared/find-limits';
import { createIpcBoundary, findRequest, findAction } from './ipc-boundary';
import type { FindInPageRequest, FindInPageAction } from '../shared/types';

const FIND_DEADLINE_MS = 30_000;
type PendingFind = { request: FindInPageRequest; current: () => void };
type NativeResult = {
  requestId: number;
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
};
const windows = new WeakMap<WebContents, NativeFind>();

/** A window owns one native search at a time. Replaceable queries coalesce; ordinary
 * next/previous steps keep order. Request ids never cross the public bridge.
 */
class NativeFind {
  private active: (PendingFind & { id: number }) | null = null;
  private queue: PendingFind[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  constructor(private readonly window: BrowserWindow) {
    const contents = window.webContents;
    contents.on('found-in-page', this.found);
    contents.on('did-start-navigation', this.navigate);
    contents.on('render-process-gone', this.lost);
    contents.once('destroyed', this.dispose);
    window.once('closed', this.dispose);
  }
  submit(request: FindInPageRequest, current: () => void): void {
    if (this.disposed) throw new Error('The find window was disposed.');
    current();
    if (!request.text) return this.stop('clearSelection');
    const latest = this.queue.at(-1)?.request ?? this.active?.request;
    if (latest && (request.text !== latest.text || request.findNext)) {
      // A new session supersedes queued work for the old query, not navigation
      // within the currently selected session. Wait for the admitted native call.
      this.queue = [];
    }
    if (this.active) {
      if (this.queue.length + 1 >= MAX_PENDING_FIND_REQUESTS)
        throw new Error('Too many pending find requests.');
      this.queue.push({ request, current });
    } else this.start({ request, current });
  }
  stop(action: FindInPageAction): void {
    this.active = null;
    this.queue = [];
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.window.isDestroyed() && !this.window.webContents.isDestroyed())
      this.window.webContents.stopFindInPage(action);
  }
  private start(pending: PendingFind): void {
    try {
      pending.current();
      const id = this.window.webContents.findInPage(pending.request.text, {
        forward: pending.request.forward,
        findNext: pending.request.findNext,
      });
      this.active = { ...pending, id };
      this.timer = setTimeout(this.lost, FIND_DEADLINE_MS);
    } catch (error) {
      this.stop('clearSelection');
      throw error;
    }
  }
  private found = (_event: unknown, result: NativeResult): void => {
    const active = this.active;
    if (!active || this.disposed || result.requestId !== active.id) return;
    try {
      active.current();
    } catch {
      this.dispose();
      return;
    }
    // Once another query is selected, an old query must not replace its UI status.
    if (!this.queue.length || this.queue[0].request.text === active.request.text) {
      this.window.webContents.send(IPC.FIND_RESULT, {
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
        finalUpdate: result.finalUpdate,
      });
    }
    if (!result.finalUpdate) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.active = null;
    const next = this.queue.shift();
    if (next) {
      // A native failure from an asynchronous event uses the same sanitized rejection
      // path as an inbound command, never an uncaught EventEmitter exception.
      try {
        this.start(next);
      } catch {
        console.error('[ipc] find:in-page: rejected request');
      }
    }
  };
  private navigate = (
    _event: unknown,
    _url: string,
    _inPlace: boolean,
    mainFrame: boolean
  ): void => {
    if (mainFrame) this.lost();
  };
  private lost = (): void => {
    try {
      this.stop('clearSelection');
    } catch {
      /* The native process is already unavailable. */
    }
  };
  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.stop('clearSelection');
    } catch {
      /* A lost native window still releases its listeners. */
    }
    const contents = this.window.webContents;
    contents.removeListener('found-in-page', this.found);
    contents.removeListener('did-start-navigation', this.navigate);
    contents.removeListener('render-process-gone', this.lost);
    contents.removeListener('destroyed', this.dispose);
    this.window.removeListener('closed', this.dispose);
    windows.delete(contents);
  };
}
function nativeFind(window: BrowserWindow): NativeFind {
  let owner = windows.get(window.webContents);
  if (!owner) {
    owner = new NativeFind(window);
    windows.set(window.webContents, owner);
  }
  return owner;
}

export function registerFindHandlers(boundary: ReturnType<typeof createIpcBoundary>): void;
export function registerFindHandlers(
  boundary: ReturnType<typeof createIpcBoundary>,
  signal: AbortSignal
): () => void;
export function registerFindHandlers(
  boundary: ReturnType<typeof createIpcBoundary>,
  signal?: AbortSignal
) {
  let owner: NativeFind | undefined;
  const dispose = () => {
    owner?.dispose();
    owner = undefined;
    signal?.removeEventListener('abort', dispose);
  };
  signal?.addEventListener('abort', dispose, { once: true });
  const getOwner = (event: IpcMainEvent) => {
    signal?.throwIfAborted();
    const next = nativeFind(boundary.assertPeer(event));
    if (owner !== next) owner?.dispose();
    owner = next;
    return next;
  };
  boundary.onCommand(IPC.FIND_IN_PAGE, findRequest, (event, request) =>
    getOwner(event).submit(request, boundary.capture(event))
  );
  boundary.onCommand(IPC.FIND_STOP, findAction, (event, action) => getOwner(event).stop(action));
  if (signal?.aborted) dispose();
  return signal ? dispose : undefined;
}
export function registerFindInPageForWindow(window: BrowserWindow): void {
  nativeFind(window);
}
