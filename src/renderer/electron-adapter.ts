import type { ReviewAdapter } from '../../packages/react/src/adapter';
import type { DesktopReadRequest, ElectronAPI, ResumeLoadPayload } from '../shared/types';
import { ElectronRequests } from './electron-requests';
import { decodeReadResult } from './read-result';

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
  ) =>
    requests.run<T>((resolve, reject) => {
      const release = on(resolve);
      const offError = api.onContentRefused?.(failure => {
        if (failure?.kind === kind)
          reject(
            new Error(
              typeof failure.message === 'string' && failure.message.length <= 2048
                ? failure.message
                : 'Review content could not be delivered.'
            )
          );
      });
      const cleanup = () => {
        release();
        offError?.();
      };
      try {
        request();
      } catch (error) {
        cleanup();
        throw error;
      }
      return cleanup;
    });
  type ReadInput<T> = T extends unknown ? Omit<T, 'id'> : never;
  const read = (request: ReadInput<DesktopReadRequest>, signal?: AbortSignal) =>
    requests.read(
      async id => {
        const result = decodeReadResult(
          await api.readContent!({ ...request, id } as DesktopReadRequest)
        );
        if (result.kind !== request.kind) throw new Error('Unexpected desktop read response.');
        return result;
      },
      api.cancelContentRead,
      signal
    );
  const reads = {
    loadFileContent: async (filePath: string, signal: AbortSignal) => {
      if (!api.readContent || !api.cancelContentRead)
        return requests.read(() => api.loadFileContent(filePath), undefined, signal);
      const result = await read({ kind: 'file', filePath }, signal);
      if (result.kind !== 'file') throw new Error('Unexpected desktop read response.');
      return result.hunks;
    },
    loadImage: async (filePath: string, signal: AbortSignal) => {
      if (!api.readContent || !api.cancelContentRead)
        return requests.read(() => api.loadImage(filePath), undefined, signal);
      const result = await read({ kind: 'image', filePath }, signal);
      if (result.kind !== 'image') throw new Error('Unexpected desktop read response.');
      return result.image;
    },
    readAttachment: async (reference: string, signal: AbortSignal) => {
      if (!api.readContent || !api.cancelContentRead)
        return requests.read(() => api.readAttachment(reference), undefined, signal);
      const result = await read({ kind: 'attachment', reference }, signal);
      if (result.kind !== 'attachment') throw new Error('Unexpected desktop read response.');
      return result.data;
    },
    expandContext: async (
      request: import('../shared/types').ExpandContextRequest,
      signal: AbortSignal
    ) => {
      if (!api.readContent || !api.cancelContentRead)
        return requests.read(() => api.expandContext(request), undefined, signal);
      const result = await read({ kind: 'context', request }, signal);
      if (result.kind !== 'context') throw new Error('Unexpected desktop read response.');
      return result.context;
    },
  };
  const adapter: ReviewAdapter = {
    reads,
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
    ...(api.saveReview &&
      api.acknowledgeReviewSave && {
        publishReview: async (state: import('../shared/types').ReviewState) => {
          const result = await requests.invoke(() => api.saveReview!(state), true);
          if (result.status === 'failed')
            throw Object.assign(new Error(result.message), {
              uncertain: false,
              details: [result.detail],
            });
          if (result.status === 'busy')
            throw Object.assign(new Error('Another save is in progress.'), { uncertain: true });
          api.acknowledgeReviewSave!(result.receipt);
        },
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
      requests.dispose();
      offResume();
      for (const release of subscriptions) release();
      resumePushes.clear();
    },
  };
}
