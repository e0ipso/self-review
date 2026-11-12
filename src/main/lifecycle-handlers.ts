import { registerOutputSelection } from './output-selection';
import { createPublicationCoordinator } from './publication-coordinator';
import { createDesktopLocalization, type DesktopLocalization } from '../shared/localization';
import { IPC } from '../shared/ipc-channels';
import type { ReviewState } from '../shared/types';
import type { QuitController, SaveFailure } from './quit-controller';
import type { DesktopSession } from './desktop-session';
import { createIpcBoundary, noArgument, reviewState, stringArgument } from './ipc-boundary';
import type { BrowserWindow } from 'electron';

export interface LifecyclePresentation {
  pickOutputPath: (window: BrowserWindow, defaultPath: string) => Promise<string | null>;
  reportSaveFailure: (window: BrowserWindow, failure: SaveFailure) => Promise<void>;
}

/** Publication and native presentation are supplied by main, alongside session ownership. */
export interface ReviewPublication {
  publish: (state: ReviewState, signal: AbortSignal) => Promise<void>;
}

export type LifecycleSession = Pick<DesktopSession, 'output' | 'operations'> & {
  review: Pick<
    DesktopSession['review'],
    'reviewState' | 'diffData' | 'attachmentOrigins' | 'outputPathInfo'
  >;
};

export function registerLifecycleHandlers(
  desktop: LifecycleSession,
  boundary: ReturnType<typeof createIpcBoundary>,
  controller: QuitController,
  shutdown: (code: number, reason: string) => Promise<void>,
  publication: ReviewPublication,
  presentation: LifecyclePresentation,
  messages: DesktopLocalization = createDesktopLocalization()
): void {
  const coordinator = createPublicationCoordinator(
    desktop,
    controller,
    shutdown,
    publication,
    presentation,
    messages
  );
  boundary.handleCommand(IPC.REVIEW_SAVE_STATUS, noArgument, () => coordinator.inspect());
  boundary.handleDeferredCommand(IPC.REVIEW_SAVE, reviewState, (event, decode) =>
    coordinator.save(() => boundary.capture(event), decode)
  );
  boundary.onCommand(IPC.REVIEW_SAVE_RECEIVED, stringArgument, (_event, token) =>
    coordinator.received(token)
  );
  boundary.onCommand(IPC.APP_SAVE_AND_QUIT, noArgument, event =>
    coordinator.legacySave(boundary.assertPeer(event), boundary.capture(event))
  );
  boundary.onCommand(IPC.APP_DISCARD_AND_QUIT, noArgument, event =>
    coordinator.discard(() => boundary.capture(event))
  );

  registerOutputSelection(desktop, boundary, controller, presentation);
}
