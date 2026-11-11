import type { ReviewAdapter } from '../../packages/react/src/adapter';
import type { ElectronAPI, ResumeLoadPayload } from '../shared/types';
import { ElectronRequests } from './electron-requests';

type ReviewAPI = Pick<
  ElectronAPI,
  | 'onDiffLoad'
  | 'requestDiffData'
  | 'onResumeLoad'
  | 'requestResumeData'
  | 'submitReview'
  | 'expandContext'
  | 'loadFileContent'
  | 'readAttachment'
  | 'changeOutputPath'
  | 'loadImage'
  | 'applySuggestion'
  | 'chooseApplyDestination'
  | 'onGuideLoad'
>;

/** Initial resume acknowledgements and later hydration share the old channel but have distinct
 * consumers. Main sends hydration only after the corresponding diff, on the same ordered peer.
 */
export function createElectronAdapter(api: ReviewAPI, requests = new ElectronRequests()) {
  let disposed = false;
  const subscriptions = new Set<() => void>();
  function subscribe<T>(
    on: (callback: (value: T) => void) => () => void,
    callback: (value: T) => void
  ) {
    if (disposed) return () => {};
    const unsubscribe = on(value => {
      if (!disposed) callback(value);
    });
    const release = () => {
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
  const adapter: ReviewAdapter = {
    loadDiff: () => requests.receive(api.onDiffLoad, api.requestDiffData),
    loadResumedReview: () => {
      resumeLoad ??= requests
        .run<ResumeLoadPayload>(resolve => {
          resumeReply = resolve;
          api.requestResumeData();
          return () => {
            resumeReply = null;
          };
        })
        .finally(() => {
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
    expandContext: request => requests.invoke(() => api.expandContext(request)),
    loadFileContent: path => requests.invoke(() => api.loadFileContent(path)),
    readAttachment: path => requests.invoke(() => api.readAttachment(path)),
    changeOutputPath: () => requests.invoke(() => api.changeOutputPath(), true),
    loadImage: path => requests.invoke(() => api.loadImage(path)),
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
      requests.dispose();
      offResume();
      for (const release of subscriptions) release();
      resumePushes.clear();
    },
  };
}
