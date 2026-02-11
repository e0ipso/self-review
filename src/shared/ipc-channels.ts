// src/shared/ipc-channels.ts
// IPC channel names — used by main, preload, and renderer.

export const IPC = {
  DIFF_LOAD: 'diff:load',
  DIFF_REQUEST: 'diff:request',
  REVIEW_SUBMIT: 'review:submit',
  RESUME_LOAD: 'resume:load',
  CONFIG_LOAD: 'config:load',
  CONFIG_REQUEST: 'config:request',
} as const;
