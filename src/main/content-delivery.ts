import type { IpcMainEvent } from 'electron';
import type { ContentLoadRefusal } from '../shared/types';
import { IPC } from '../shared/ipc-channels';
import type { createIpcBoundary } from './ipc-boundary';
import type { DesktopOperations } from './desktop-operations';
import { ownContent } from './content-lifetime';

/** At most one outstanding preparation/delivery per kind. Coalesced callers attach no
 * callbacks to the retained work. Admission includes preparation, ordering and delivery. */
export function contentDelivery(
  boundary: ReturnType<typeof createIpcBoundary>,
  operations: DesktopOperations,
  captureSnapshot?: () => () => void
) {
  type Kind = ContentLoadRefusal['kind'];
  const pending = new Map<Kind, { owner: ReturnType<typeof ownContent>; done: Promise<boolean> }>();
  return (kind: Kind, event: IpcMainEvent, deliver: () => void): void => {
    const earlier = pending.get(kind);
    if (earlier) {
      try {
        earlier.owner.assertCurrent();
        return;
      } catch {
        earlier.owner.abort();
      }
    }
    const owner = ownContent(event, boundary, operations, captureSnapshot);
    const diff = kind === 'resume' ? pending.get('diff')?.done : undefined;
    const done = operations
      .readOwned(async signal => {
        if (diff && !(await diff))
          throw new Error('The diff could not be delivered. Retry loading the review.');
        signal.throwIfAborted();
        owner.assertCurrent();
        deliver();
        owner.assertCurrent();
        return true;
      }, owner.signal)
      .catch(error => {
        // Refusal preserves the last successful payload. Never send an empty substitute.
        try {
          owner.assertCurrent();
          const message = (
            error instanceof Error ? error.message : 'Review content could not be delivered.'
          ).slice(0, 2048);
          event.sender.send(IPC.CONTENT_REFUSED, { kind, message } satisfies ContentLoadRefusal);
          console.error(`[ipc] ${kind}: ${message}`);
        } catch {
          /* A stale or destroyed peer must receive nothing. */
        }
        return false;
      })
      .finally(() => {
        owner.release();
        if (pending.get(kind)?.owner === owner) pending.delete(kind);
      });
    pending.set(kind, { owner, done });
  };
}
