import { publishReview } from '../../packages/core/src/review-publisher';
import { applyRemoteProvenance } from '../../packages/core/src/remote-mode';
import { publicationOptions, type DesktopSession } from './desktop-session';
import type { ReviewPublication } from './lifecycle-handlers';

/** The Electron composition root supplies this concrete output writer to lifecycle policy. */
export function createDesktopPublication(desktop: DesktopSession): ReviewPublication {
  return {
    async publish(state, signal) {
      const finalState = desktop.remoteInfo
        ? applyRemoteProvenance(state, desktop.remoteInfo)
        : state;
      await publishReview(finalState, desktop.output.path, {
        ...publicationOptions(desktop),
        signal,
      });
      console.error(`[main] Review written to ${desktop.output.path}`);
    },
  };
}
