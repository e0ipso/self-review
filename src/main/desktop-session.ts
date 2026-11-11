import { resolve } from 'path';
import { createReviewSession } from '../../packages/core/src/review-handlers';
import { inspectOutputPath } from '../../packages/core/src/review-publisher';
import { publishOptionsFor } from '../../packages/core/src/startup';
import type { ReviewOutputTarget } from '../../packages/core/src/review-publisher';
import type { RemoteSessionInfo } from '../shared/types';
import { RemoteLifetime } from './remote-lifetime';
import { DesktopOperations } from './desktop-operations';
import { ReviewTransition } from './review-transition';

/** Created once in main; startup and both sets of IPC handlers share this owner. */
export function createDesktopSession(cwd: string) {
  const review = createReviewSession();
  return {
    cwd,
    review,
    operations: new DesktopOperations(),
    remote: new RemoteLifetime(),
    transition: new ReviewTransition(review),
    remoteInfo: null as RemoteSessionInfo | null,
    output: {
      path: resolve(cwd, 'review.xml'),
      origin: 'inherited',
      baseDir: cwd,
    } as ReviewOutputTarget,
  };
}
export type DesktopSession = ReturnType<typeof createDesktopSession>;

export function publicationOptions(desktop: Pick<DesktopSession, 'output' | 'review'>) {
  return publishOptionsFor(desktop.output, desktop.review.attachmentOrigins);
}

export function updateOutputInfo(desktop: Pick<DesktopSession, 'output' | 'review'>) {
  const problem = inspectOutputPath(desktop.output.path, publicationOptions(desktop));
  if (problem) console.error(`[main] Output path check (${problem.code}): ${problem.message}`);
  return (desktop.review.outputPathInfo = {
    resolvedOutputPath: desktop.output.path,
    outputPathWritable: problem === null,
  });
}
