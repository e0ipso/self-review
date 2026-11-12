// Older hosts have no correlated cancellation channel. Local cancellation/deadlines still
// release renderer admission and discard late replies. Remove with the old bridge methods
// only when the supported host minimum guarantees both correlated read capabilities.
import type { DesktopContentAPI, ReviewReads } from '../shared/types';
import type { ElectronRequests } from './electron-requests';

export function createLegacyDesktopReads(
  api: Pick<
    DesktopContentAPI,
    'loadFileContent' | 'loadImage' | 'readAttachment' | 'expandContext'
  >,
  requests: ElectronRequests
): Required<ReviewReads> {
  return {
    loadFileContent: (path, signal) =>
      requests.read(() => api.loadFileContent(path), undefined, signal),
    loadImage: (path, signal) => requests.read(() => api.loadImage(path), undefined, signal),
    readAttachment: (path, signal) =>
      requests.read(() => api.readAttachment(path), undefined, signal),
    expandContext: (request, signal) =>
      requests.read(() => api.expandContext(request), undefined, signal),
  };
}
