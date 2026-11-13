import { IPC } from '../shared/ipc-channels';
import type { createIpcBoundary } from './ipc-boundary';
import { noArgument, stringArgument } from './ipc-boundary';
import type { DesktopOperations } from './desktop-operations';
import type { ReviewPresentation } from './presentation';
import type { AppInfo } from '../shared/types';
export function registerApplicationHandlers(
  boundary: ReturnType<typeof createIpcBoundary>,
  operations: DesktopOperations,
  presentation: Pick<ReviewPresentation, 'appInfo' | 'versionUpdate' | 'openExternal'>
) {
  // Handle app info request from renderer (version + icon for the About dialog)
  boundary.handleCommand(IPC.APP_GET_INFO, noArgument, async (): Promise<AppInfo> => {
    return operations.read(() => presentation.appInfo());
  });

  // Handle version update request from renderer
  boundary.onCommand(IPC.VERSION_UPDATE_REQUEST, noArgument, event => {
    const update = presentation.versionUpdate();
    if (update) {
      event.sender.send(IPC.VERSION_UPDATE_AVAILABLE, update);
    }
  });

  // One native open may be in flight; equivalent requests join its actual completion.
  let opening: { url: string; work: Promise<void> } | null = null;
  // Handle open-external requests from renderer
  boundary.handleCommand(IPC.OPEN_EXTERNAL, stringArgument, async (event, url: string) => {
    // Security: only allow https://github.com/ URLs
    if (typeof url === 'string' && url.startsWith('https://github.com/')) {
      const assertCurrent = boundary.capture(event);
      operations.signal.throwIfAborted();
      if (operations.finishing) throw new Error('The review is finishing.');
      if (opening) {
        if (opening.url !== url) throw new Error('An external URL is already being opened.');
        return opening.work;
      }
      const work = operations.read(async signal => {
        assertCurrent();
        signal.throwIfAborted();
        if (operations.finishing) throw new Error('The review is finishing.');
        // Native opening cannot be rolled back or interrupted. Admission stays owned until it settles.
        await presentation.openExternal(url);
      });
      const entry = { url, work };
      opening = entry;
      const release = () => {
        if (opening === entry) opening = null;
      };
      void work.then(release, release);
      return work;
    }
  });
}
