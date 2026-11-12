// Every desktop command enters through the current window's main frame.
import type { BrowserWindow, IpcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import {
  decodeSuggestionApplyRequest,
  MAX_CONTEXT_LINES,
} from '../../packages/core/src/review-request-validation';
import { preflightReviewMessage } from './ipc-review-budget';
import { validateReviewState } from '../../packages/core/src/review-state-validation';
import type {
  ExpandContextRequest,
  FindInPageRequest,
  FindInPageAction,
  SuggestionApplyRequest,
} from '../shared/types';

type PeerEvent = IpcMainEvent | IpcMainInvokeEvent;
type Decode<T> = (value: unknown) => T;

export function createIpcBoundary(
  ipc: Pick<IpcMain, 'on' | 'handle'>,
  getWindow: () => BrowserWindow | null
) {
  function assertPeer(event: PeerEvent): BrowserWindow {
    const window = getWindow();
    if (
      !window ||
      window.isDestroyed() ||
      window.webContents.isDestroyed() ||
      event.sender !== window.webContents ||
      !event.senderFrame ||
      event.senderFrame !== window.webContents.mainFrame
    ) {
      throw new Error('IPC request is not from the current review window main frame.');
    }
    return window;
  }

  function capture(event: PeerEvent): () => void {
    const window = assertPeer(event);
    const frame = event.senderFrame;
    return () => {
      if (assertPeer(event) !== window || event.senderFrame !== frame)
        throw new Error('The requesting review window has changed.');
    };
  }

  return {
    assertPeer,
    capture,
    on<T>(channel: string, decode: Decode<T>, run: (event: IpcMainEvent, value: T) => unknown) {
      ipc.on(channel, (event, ...args: unknown[]) => {
        try {
          assertPeer(event);
          const value = decodeArgument(decode, args);
          Promise.resolve(run(event, value)).catch(() => {
            console.error(`[ipc] ${channel}: command failed`);
          });
        } catch {
          // Never include untrusted bodies or paths in a rejection log.
          console.error(`[ipc] ${channel}: rejected request`);
        }
      });
    },
    handle<T, R>(
      channel: string,
      decode: Decode<T>,
      run: (event: IpcMainInvokeEvent, value: T) => R
    ) {
      ipc.handle(channel, (event, ...args: unknown[]) => {
        assertPeer(event);
        return run(event, decodeArgument(decode, args));
      });
    },
  };
}

function decodeArgument<T>(decode: Decode<T>, args: unknown[]): T {
  if (args.length > 1) throw new Error('Unexpected IPC arguments.');
  return decode(args[0]);
}

export function noArgument(value: unknown): void {
  if (value !== undefined) throw new Error('This command has no payload.');
}
export function stringArgument(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string payload.');
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object payload.');
  return value as Record<string, unknown>;
}
export function findRequest(value: unknown): FindInPageRequest {
  const request = object(value);
  stringArgument(request.text);
  for (const key of ['forward', 'findNext']) {
    if (typeof request[key] !== 'boolean') throw new Error('Invalid find options.');
  }
  return value as FindInPageRequest;
}
export function findAction(value: unknown): FindInPageAction {
  if (value !== 'clearSelection' && value !== 'keepSelection' && value !== 'activateSelection')
    throw new Error('Invalid find action.');
  return value;
}
export function expansionRequest(value: unknown): ExpandContextRequest {
  const request = object(value);
  stringArgument(request.filePath);
  if (
    !Number.isSafeInteger(request.contextLines) ||
    (request.contextLines as number) < 0 ||
    (request.contextLines as number) > MAX_CONTEXT_LINES
  )
    throw new Error('Invalid context line count.');
  return value as ExpandContextRequest;
}
export function suggestionRequest(value: unknown): SuggestionApplyRequest {
  const decoded = decodeSuggestionApplyRequest(value);
  if (!decoded.ok) throw new Error(decoded.error);
  return decoded.value;
}
export function reviewState(value: unknown) {
  preflightReviewMessage(value);
  return validateReviewState(value);
}
