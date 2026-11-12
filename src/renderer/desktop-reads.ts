import type { ReviewReads, DesktopReadRequest, DesktopContentAPI } from '../shared/types';
import type { ElectronRequests } from './electron-requests';
import { decodeReadResult } from './read-result';
import { createLegacyDesktopReads } from './legacy-desktop-reads';

type ReadInput<T> = T extends unknown ? Omit<T, 'id'> : never;

/** Select once when composing the renderer, including hosts that expose only half a capability. */
export function createDesktopReads(
  api: DesktopContentAPI,
  requests: ElectronRequests
): Required<ReviewReads> {
  const readContent = api.readContent?.bind(api);
  const cancelContentRead = api.cancelContentRead?.bind(api);
  if (!readContent || !cancelContentRead) return createLegacyDesktopReads(api, requests);
  const read = (request: ReadInput<DesktopReadRequest>, signal: AbortSignal) =>
    requests.read(
      async id => {
        const result = decodeReadResult(
          await readContent({ ...request, id } as DesktopReadRequest)
        );
        if (result.kind !== request.kind) throw new Error('Unexpected desktop read response.');
        return result;
      },
      cancelContentRead,
      signal
    );
  return {
    loadFileContent: async (filePath, signal) => {
      const result = await read({ kind: 'file', filePath }, signal);
      if (result.kind !== 'file') throw new Error('Unexpected desktop read response.');
      return result.hunks;
    },
    loadImage: async (filePath, signal) => {
      const result = await read({ kind: 'image', filePath }, signal);
      if (result.kind !== 'image') throw new Error('Unexpected desktop read response.');
      return result.image;
    },
    readAttachment: async (reference, signal) => {
      const result = await read({ kind: 'attachment', reference }, signal);
      if (result.kind !== 'attachment') throw new Error('Unexpected desktop read response.');
      return result.data;
    },
    expandContext: async (request, signal) => {
      const result = await read({ kind: 'context', request }, signal);
      if (result.kind !== 'context') throw new Error('Unexpected desktop read response.');
      return result.context;
    },
  };
}
