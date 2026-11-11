import type { ReviewAdapter } from '../../packages/react/src/adapter';
import type { ElectronAPI } from '../shared/types';

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

/** Owns temporary request listeners; the host effect releases pending ones on unmount. */
export function createElectronAdapter(api: ReviewAPI) {
  const pending = new Set<() => void>();
  function receive<T>(
    subscribe: (callback: (value: T) => void) => () => void,
    request: () => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      let received = false;
      const release = () => {
        unsubscribe();
        pending.delete(release);
      };
      pending.add(release);
      unsubscribe = subscribe(value => {
        received = true;
        release();
        resolve(value);
      });
      // Also supports a host fake delivering synchronously during subscription.
      if (received) release();
      try {
        request();
      } catch (error) {
        release();
        reject(error);
      }
    });
  }
  const adapter: ReviewAdapter = {
    loadDiff: () => receive(api.onDiffLoad, api.requestDiffData),
    // An absent resume intentionally has no reply on the existing channel. Its listener stays
    // available for welcome-to-remote hydration and is released when the host unmounts.
    loadResumedReview: () => receive(api.onResumeLoad, api.requestResumeData),
    submitReview: state => api.submitReview(state),
    expandContext: request => api.expandContext(request),
    loadFileContent: path => api.loadFileContent(path),
    readAttachment: path => api.readAttachment(path),
    changeOutputPath: () => api.changeOutputPath(),
    loadImage: path => api.loadImage(path),
    applySuggestion: request => api.applySuggestion(request),
    chooseApplyDestination: () => api.chooseApplyDestination(),
    onGuideLoad: callback => api.onGuideLoad(callback),
    onDiffLoad: callback => api.onDiffLoad(callback),
  };
  return {
    adapter,
    dispose: () => {
      for (const release of pending) release();
    },
  };
}
