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

  // Handle open-external requests from renderer
  boundary.handleCommand(IPC.OPEN_EXTERNAL, stringArgument, async (_event, url: string) => {
    // Security: only allow https://github.com/ URLs
    if (typeof url === 'string' && url.startsWith('https://github.com/')) {
      await presentation.openExternal(url);
    }
  });
}
