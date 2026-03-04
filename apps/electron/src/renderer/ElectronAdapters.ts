import type { ReviewAdapter, ConfigAdapter } from '@self-review/react';
import type { DiffLoadPayload, ResumeLoadPayload } from '@self-review/core';

/**
 * ReviewAdapter implementation that wraps window.electronAPI IPC calls.
 * Used by the Electron app's renderer process.
 */
export const electronReviewAdapter: ReviewAdapter = {
  loadDiff: () =>
    new Promise<DiffLoadPayload>(resolve => {
      window.electronAPI.onDiffLoad(resolve);
      window.electronAPI.requestDiffData();
    }),

  loadResumedComments: () =>
    new Promise(resolve => {
      window.electronAPI.onResumeLoad((payload: ResumeLoadPayload) =>
        resolve(payload.comments)
      );
      window.electronAPI.requestResumeData();
    }),

  submitReview: async state => {
    window.electronAPI.submitReview(state);
  },

  expandContext: request => window.electronAPI.expandContext(request),

  loadFileContent: filePath => window.electronAPI.loadFileContent(filePath),

  readAttachment: filePath => window.electronAPI.readAttachment(filePath),

  changeOutputPath: () => window.electronAPI.changeOutputPath(),
};
