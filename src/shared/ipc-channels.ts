// src/shared/ipc-channels.ts
// IPC channel names — used by main, preload, and renderer.

export const IPC = {
  DIFF_LOAD: 'diff:load',
  REVIEW_SUBMIT: 'review:submit',
  RESUME_LOAD: 'resume:load',
  CONFIG_LOAD: 'config:load',
} as const;
