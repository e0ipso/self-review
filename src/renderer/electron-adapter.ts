import type { ReviewAdapter } from '../../packages/react/src/adapter';
import type { ElectronAPI, ResumeLoadPayload } from '../shared/types';
import { ElectronRequests } from './electron-requests';
import { createDesktopReads } from './desktop-reads';
import { createDesktopPublicationClient } from './desktop-publication-client';
import { receiveDesktopContent, receiveOwnedDesktopContent } from './desktop-content';

type ReviewAPI = Pick<
  ElectronAPI,
  | 'onDiffLoad'
  | 'requestDiffData'
  | 'onResumeLoad'
  | 'requestResumeData'
  | 'submitReview'
  | 'handoffReview'
  | 'saveReview'
  | 'acknowledgeReviewSave'
  | 'expandContext'
  | 'loadFileContent'
  | 'readAttachment'
  | 'changeOutputPath'
  | 'loadImage'
  | 'applySuggestion'
  | 'chooseApplyDestination'
  | 'onGuideLoad'
  | 'readContent'
  | 'cancelContentRead'
  | 'onContentRefused'
>;

/** Initial resume acknowledgements and later hydration share the old channel but have distinct
 * consumers. Main sends hydration only after the corresponding diff, on the same ordered peer.
 */
export function createElectronAdapter(api: ReviewAPI, requests = new ElectronRequests()) {
  let disposed = false;
  const publication = createDesktopPublicationClient(api);
  const subscriptions = new Set<() => void>();
  function subscribe<T>(
    on: (callback: (value: T) => void) => () => void,
    callback: (value: T) => void
  ) {
    if (disposed) return () => {};
    let active = true;
    const unsubscribe = on(value => {
      if (!disposed && active) callback(value);
    });
    const release = () => {
      if (!active) return;
      active = false;
      subscriptions.delete(release);
      unsubscribe();
    };
    subscriptions.add(release);
    return release;
  }
  let resumeReply: ((value: ResumeLoadPayload) => void) | null = null;
  let resumeLoad: Promise<ResumeLoadPayload> | null = null;
  const resumePushes = new Set<(value: ResumeLoadPayload) => void>();
  const offResume = api.onResumeLoad(value => {
    if (disposed) return;
    if (resumeReply) resumeReply(value);
    else for (const callback of resumePushes) callback(value);
  });
  const receiveContent = <T>(
    kind: 'diff' | 'resume',
    on: (callback: (value: T) => void) => () => void,
    request: () => void
  ) => receiveDesktopContent(requests, api, kind, on, request);
  const reads = createDesktopReads(api, requests);
  const adapter: ReviewAdapter = {
    reads,
    initialReads: {
      loadDiff: signal =>
        receiveOwnedDesktopContent(
          requests,
          api,
          'diff',
          api.onDiffLoad,
          api.requestDiffData,
          signal
        ),
      // Resume uses an uncorrelated reply/push channel. Keep its original owner until
      // acknowledgement so cancelling a waiter cannot reinterpret a late reply as a push.
    },
    loadDiff: () => receiveContent('diff', api.onDiffLoad, api.requestDiffData),
    loadResumedReview: () => {
      resumeLoad ??= receiveContent<ResumeLoadPayload>(
        'resume',
        resolve => {
          resumeReply = resolve;
          return () => {
            resumeReply = null;
          };
        },
        api.requestResumeData
      ).finally(() => {
        resumeLoad = null;
      });
      return resumeLoad;
    },
    onResumeLoad: callback => {
      if (!disposed) resumePushes.add(callback);
      return () => {
        resumePushes.delete(callback);
      };
    },
    submitReview: state => api.submitReview(state),
    ...(api.handoffReview && {
      handoffReview: (state: import('../shared/types').ReviewState) =>
        requests.invoke(() => api.handoffReview!(state)),
    }),
    ...(publication.modern && {
      publishReview: (state: import('../shared/types').ReviewState) =>
        requests.run<void>((resolve, reject) => {
          let current = true;
          void publication.publish(state, () => current && !disposed).then(resolve, reject);
          return () => {
            current = false;
          };
        }, true),
    }),
    expandContext: request => reads.expandContext(request, new AbortController().signal),
    loadFileContent: path => reads.loadFileContent(path, new AbortController().signal),
    readAttachment: path => reads.readAttachment(path, new AbortController().signal),
    changeOutputPath: () => requests.invoke(() => api.changeOutputPath(), true),
    loadImage: path => reads.loadImage(path, new AbortController().signal),
    applySuggestion: request => requests.invoke(() => api.applySuggestion(request), true),
    chooseApplyDestination: () => requests.invoke(() => api.chooseApplyDestination(), true),
    onGuideLoad: callback => subscribe(api.onGuideLoad, callback),
    onDiffLoad: callback => subscribe(api.onDiffLoad, callback),
  };
  return {
    adapter,
    requests,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      publication.dispose();
      requests.dispose();
      offResume();
      for (const release of subscriptions) release();
      resumePushes.clear();
    },
  };
}
