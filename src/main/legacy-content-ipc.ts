// Compatibility for hosts using the four original read methods. Remove only when those
// methods and wire channels can be retired in a breaking bridge release.
import { IPC } from '../shared/ipc-channels';
import type { createIpcBoundary } from './ipc-boundary';
import type { DesktopOperations } from './desktop-operations';
import type { ImageLoadResult, ExpandContextRequest } from '../shared/types';
import {
  attachmentValue,
  contentPath,
  contentExpansionRequest,
  type ContentReview,
} from './content-reads';
import { checkContentBudget } from './content-budget';

export function registerLegacyContentHandlers(
  review: ContentReview,
  boundary: ReturnType<typeof createIpcBoundary>,
  operations: DesktopOperations
): void {
  // Handle image loading for rendered preview
  boundary.handleCommand(
    IPC.DIFF_LOAD_IMAGE,
    contentPath,
    async (_event, filePath: string): Promise<ImageLoadResult> =>
      operations.read(async signal => {
        const result = await review.loadImage(filePath, signal);
        checkContentBudget(result);
        return result;
      })
  );

  // Handle single-file content loading for lazy (large-payload) mode
  boundary.handleCommand(IPC.DIFF_LOAD_FILE, contentPath, async (_event, filePath: string) =>
    operations.read(async () => {
      const result = review.getFileHunks(filePath);
      checkContentBudget({ hunks: result });
      return result;
    })
  );

  // Core owns authorization and filesystem policy. Only a missing asset becomes null.
  boundary.handleCommand(
    IPC.ATTACHMENT_READ,
    contentPath,
    async (_event, reference: unknown): Promise<ArrayBuffer | null> => {
      const result = await operations.read(signal => review.readAttachment(reference, signal));
      const value = attachmentValue(result);
      checkContentBudget(value);
      return value;
    }
  );

  // Expand context for a single file by re-running git diff with more context lines
  boundary.handleCommand(
    IPC.DIFF_EXPAND_CONTEXT,
    contentExpansionRequest,
    async (_event, request: ExpandContextRequest) =>
      operations.apply(async signal => {
        const result = await review.expandContext(request, signal);
        checkContentBudget(result);
        return result;
      })
  );
}
