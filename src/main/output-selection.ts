import { resolve } from 'path';
import { IPC } from '../shared/ipc-channels';
import type { OutputPathInfo } from '../shared/types';
import { updateOutputInfo } from './desktop-session';
import { noArgument, type createIpcBoundary } from './ipc-boundary';
import type { LifecycleSession, LifecyclePresentation } from './lifecycle-handlers';
import type { QuitController } from './quit-controller';

/** Native selection changes the target only while the requesting review remains active. */
export function registerOutputSelection(
  desktop: LifecycleSession,
  boundary: ReturnType<typeof createIpcBoundary>,
  controller: Pick<QuitController, 'phase'>,
  presentation: Pick<LifecyclePresentation, 'pickOutputPath'>
): void {
  boundary.handleCommand(IPC.OUTPUT_PATH_CHANGE, noArgument, event =>
    desktop.operations.read(async signal => {
      const current = boundary.capture(event);
      const filePath = await presentation.pickOutputPath(
        boundary.assertPeer(event),
        desktop.output.path
      );
      if (!filePath) return null;
      current();
      signal.throwIfAborted();
      if (controller.phase !== 'reviewing') return null;
      desktop.output = { path: resolve(filePath), origin: 'explicit' };
      const info: OutputPathInfo = updateOutputInfo(desktop);
      boundary.assertPeer(event).webContents.send(IPC.OUTPUT_PATH_CHANGED, info);
      return info;
    }, 10 * 60_000)
  );
}
