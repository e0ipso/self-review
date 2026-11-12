import type { DesktopReadRequest, DesktopReadResult } from '../shared/types';
import { expansionRequest, stringArgument } from './ipc-boundary';
import { IPC } from '../shared/ipc-channels';
import type { createIpcBoundary } from './ipc-boundary';
import type { DesktopOperations } from './desktop-operations';
import type { DesktopReviewOperations } from './review-operations';
import { ownContent } from './content-lifetime';
import { checkContentBudget } from './content-budget';

export type ContentReview = Pick<
  DesktopReviewOperations,
  'loadImage' | 'getFileHunks' | 'readAttachment' | 'expandContext'
> &
  Partial<Pick<DesktopReviewOperations, 'captureReadSnapshot'>>;

export function readId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[1-9][0-9]{0,15}$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new Error('Invalid content request id.');
  return value;
}
export function contentPath(value: unknown): string {
  const result = stringArgument(value);
  if (result.length > 4096) throw new Error('Content path exceeds desktop request limits.');
  return result;
}
export function contentExpansionRequest(value: unknown) {
  const request = expansionRequest(value);
  return { filePath: contentPath(request.filePath), contextLines: request.contextLines };
}
function readRequest(value: unknown): DesktopReadRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid content request.');
  const input = value as Record<string, unknown>;
  // Bound extension metadata before traversing it or starting any operation.
  let keys = 0;
  for (const key in input)
    if (Object.prototype.hasOwnProperty.call(input, key) && ++keys > 3)
      throw new Error('Unexpected content request metadata.');
  const id = readId(input.id);
  switch (input.kind) {
    case 'file':
    case 'image':
      return { id, kind: input.kind, filePath: contentPath(input.filePath) };
    case 'attachment':
      return { id, kind: 'attachment', reference: contentPath(input.reference) };
    case 'context': {
      const request = contentExpansionRequest(input.request);
      return {
        id,
        kind: 'context',
        request,
      };
    }
    default:
      throw new Error('Unsupported content read.');
  }
}

export function attachmentValue(
  result: Awaited<ReturnType<DesktopReviewOperations['readAttachment']>>
): ArrayBuffer | null {
  if (result.ok) return result.data;
  if (result.reason === 'not-found') return null;
  throw Object.assign(new Error(result.message.slice(0, 2048)), { code: result.reason });
}

export function registerReadHandlers(
  review: ContentReview,
  boundary: ReturnType<typeof createIpcBoundary>,
  operations: DesktopOperations
) {
  const pending = new Map<
    string,
    { event: Parameters<typeof boundary.capture>[0]; owner: ReturnType<typeof ownContent> }
  >();
  let peer: Parameters<typeof boundary.capture>[0] | null = null;
  let lastId = 0;
  const reset = () => {
    lastId = 0;
  };
  const disposePeer = () => {
    peer?.sender.removeListener?.('did-start-navigation', navigate);
    peer?.sender.removeListener?.('destroyed', disposePeer);
    peer = null;
    reset();
  };
  const navigate = (_event: unknown, _url: string, _inPlace: boolean, mainFrame: boolean) => {
    if (mainFrame) reset();
  };
  operations.signal.addEventListener('abort', disposePeer, { once: true });
  boundary.onCommand(IPC.CONTENT_CANCEL, readId, (event, id) => {
    const entry = pending.get(id);
    if (
      entry &&
      entry.event.sender === event.sender &&
      entry.event.senderFrame === event.senderFrame
    ) {
      // A late cancel for an obsolete snapshot cannot affect a new session's work.
      entry.owner.abort();
    }
  });
  boundary.handleCommand(
    IPC.CONTENT_READ,
    readRequest,
    async (event, request): Promise<DesktopReadResult> => {
      if (peer?.sender !== event.sender || peer?.senderFrame !== event.senderFrame) {
        peer?.sender.removeListener?.('did-start-navigation', navigate);
        peer?.sender.removeListener?.('destroyed', disposePeer);
        peer = event;
        reset();
        event.sender.on?.('did-start-navigation', navigate);
        event.sender.once?.('destroyed', disposePeer);
      }
      if (pending.has(request.id)) throw new Error('Content request id is already pending.');
      if (Number(request.id) <= lastId) throw new Error('Content request id was already used.');
      if (pending.size >= 32) throw new Error('Too many pending content reads.');
      const owner = ownContent(event, boundary, operations, review.captureReadSnapshot);
      lastId = Number(request.id);
      const entry = { event, owner };
      const remove = () => {
        if (pending.get(request.id) === entry) pending.delete(request.id);
      };
      pending.set(request.id, entry);
      owner.signal.addEventListener('abort', remove, { once: true });
      const run = async (signal: AbortSignal): Promise<DesktopReadResult> => {
        owner.assertCurrent();
        switch (request.kind) {
          case 'file':
            return { kind: 'file', hunks: review.getFileHunks(request.filePath) };
          case 'image':
            return { kind: 'image', image: await review.loadImage(request.filePath, signal) };
          case 'attachment':
            return {
              kind: 'attachment',
              data: attachmentValue(await review.readAttachment(request.reference, signal)),
            };
          case 'context':
            return {
              kind: 'context',
              context: await review.expandContext(request.request, signal),
            };
        }
      };
      try {
        const result =
          request.kind === 'context'
            ? await operations.apply(signal => run(AbortSignal.any([signal, owner.signal])))
            : await operations.readOwned(run, owner.signal);
        owner.assertCurrent();
        checkContentBudget(result);
        return result;
      } catch (error) {
        return {
          kind: 'error',
          code:
            typeof (error as { code?: unknown })?.code === 'string'
              ? (error as { code: string }).code.slice(0, 80)
              : 'read-failed',
          message: (error instanceof Error ? error.message : 'Content read failed.').slice(0, 2048),
        };
      } finally {
        remove();
        owner.signal.removeEventListener('abort', remove);
        owner.release();
      }
    }
  );
}
