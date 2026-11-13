import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import type { createIpcBoundary } from './ipc-boundary';
import type { DesktopOperations } from './desktop-operations';

/** One validated frame/snapshot owns the read through delivery. Session writes outside this
 * registrar have no notification API, so one bounded ownership check also covers those changes. */
export function ownContent(
  event: IpcMainEvent | IpcMainInvokeEvent,
  boundary: ReturnType<typeof createIpcBoundary>,
  operations: DesktopOperations,
  captureSnapshot?: () => () => void
) {
  const peer = boundary.capture(event);
  const snapshot = captureSnapshot?.() ?? (() => {});
  const controller = new AbortController();
  const assertCurrent = () => {
    controller.signal.throwIfAborted();
    peer();
    snapshot();
  };
  assertCurrent();
  const abort = () => controller.abort(new Error('The content read owner was disposed.'));
  const navigate = (_event: unknown, _url: string, _inPlace: boolean, mainFrame: boolean) => {
    if (mainFrame) abort();
  };
  const check = () => {
    try {
      assertCurrent();
    } catch (error) {
      controller.abort(error);
    }
  };
  const interval = setInterval(check, 50);
  const deadline = setTimeout(
    () => controller.abort(new Error('The desktop content read timed out.')),
    30_000
  );
  operations.signal.addEventListener('abort', abort, { once: true });
  event.sender.on?.('destroyed', abort);
  event.sender.on?.('render-process-gone', abort);
  event.sender.on?.('did-start-navigation', navigate);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearInterval(interval);
    clearTimeout(deadline);
    operations.signal.removeEventListener('abort', abort);
    event.sender.removeListener?.('destroyed', abort);
    event.sender.removeListener?.('render-process-gone', abort);
    event.sender.removeListener?.('did-start-navigation', navigate);
    controller.signal.removeEventListener('abort', release);
  };
  controller.signal.addEventListener('abort', release, { once: true });
  if (operations.signal.aborted) abort();
  return { signal: controller.signal, assertCurrent, abort, release };
}
