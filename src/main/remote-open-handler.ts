import { IPC } from '../shared/ipc-channels';
import type { RemoteOpenUrlResult } from '../shared/types';
import { parseForgeUrl, isCommandCancelled } from '../../packages/core/src/forge-provider';
import type { DesktopSession } from './desktop-session';
import { createIpcBoundary, stringArgument } from './ipc-boundary';
import type { ReviewPresentation } from './presentation';
import { bindRemoteOpening } from './remote-opening-binding';
import { REMOTE_OPEN_TIMEOUT_MS, type RemoteOpeningOperation } from './remote-opening';

/** Authenticate the peer and map the existing command result. Application policy is injected. */
export function registerRemoteOpenHandler(
  desktop: DesktopSession,
  boundary: ReturnType<typeof createIpcBoundary>,
  presentation: Pick<ReviewPresentation, 'confirmPayload'>,
  open: RemoteOpeningOperation = bindRemoteOpening(desktop)
): void {
  boundary.handleCommand(
    IPC.REMOTE_OPEN_URL,
    stringArgument,
    async (event, url): Promise<RemoteOpenUrlResult> =>
      desktop.operations.read(async signal => {
        const current = boundary.capture(event);
        const window = boundary.assertPeer(event);
        const abort = new AbortController();
        const cancel = () => abort.abort(new Error('the review window closed'));
        window.once('closed', cancel);
        try {
          if (!parseForgeUrl(url)) throw new Error('Enter a GitHub PR or GitLab MR URL.');
          const accepted = await open(url, {
            signal: AbortSignal.any([signal, abort.signal]),
            cancellation: abort,
            assertCurrent: current,
            confirm: async payload => {
              const config = desktop.review.config;
              return (
                !config || presentation.confirmPayload(payload, config, boundary.assertPeer(event))
              );
            },
            send: (channel, payload) =>
              boundary.assertPeer(event).webContents.send(channel, payload),
          });
          return accepted ? { ok: true } : { ok: false, error: 'Review cancelled.' };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // External command diagnostics may contain credentials; only the bounded plain-text
          // presentation displays them. Main logs the event without echoing command arguments.
          console.error('[main] Failed to open remote URL');
          return {
            ok: false,
            error: isCommandCancelled(error)
              ? `Opening the PR/MR was cancelled: ${abort.signal.reason instanceof Error ? abort.signal.reason.message : message}`
              : message,
          };
        } finally {
          window.removeListener('closed', cancel);
        }
      }, REMOTE_OPEN_TIMEOUT_MS)
  );
}
