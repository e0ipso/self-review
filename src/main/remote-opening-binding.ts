import { bootstrapRemoteDiff } from '../../packages/core/src/remote-mode';
import { loadGuide } from '../../packages/core/src/guide-loader';
import { commitDiffData } from '../../packages/core/src/review-handlers';
import type { DesktopSession } from './desktop-session';
import { createRemoteOpeningOperation } from './remote-opening';

/** Concrete engine policy is wired here; the opening operation owns its lifetime and handoff. */
export function bindRemoteOpening(desktop: DesktopSession) {
  return createRemoteOpeningOperation({
    remote: desktop.remote,
    transition: desktop.transition,
    acquire: (url, signal) =>
      bootstrapRemoteDiff(url, desktop.cwd, desktop.review.config?.ignore ?? [], {}, { signal }),
    loadGuide: (payload, signal) => {
      const config = desktop.review.config;
      return config
        ? loadGuide(
            desktop.output.path,
            config,
            payload.files.map(file => file.newPath || file.oldPath),
            { cwd: desktop.cwd, reportDiagnostic: message => console.error(message), signal }
          )
        : Promise.resolve(null);
    },
    adopt: ({ session, payload, identity }, guide, resume) => {
      commitDiffData(desktop.review, payload, identity);
      desktop.remoteInfo = session.remote;
      desktop.review.guideData = guide;
      desktop.review.resumeComments = resume.comments;
      desktop.review.resumeViewedFiles = resume.viewedFiles ?? [];
      desktop.review.resumeRemoteDrift = null;
      desktop.review.resumeImportDiagnostics = [];
      desktop.review.reviewState = null;
    },
  });
}
