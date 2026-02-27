// src/shared/ipc-channels.ts
// IPC channel names — used by main, preload, and renderer.

export const IPC = {
  DIFF_LOAD: 'diff:load',
  DIFF_REQUEST: 'diff:request',
  REVIEW_SUBMIT: 'review:submit',
  RESUME_LOAD: 'resume:load',
  RESUME_REQUEST: 'resume:request',
  CONFIG_LOAD: 'config:load',
  CONFIG_REQUEST: 'config:request',
  APP_CLOSE_REQUESTED: 'app:close-requested',
  APP_SAVE_AND_QUIT: 'app:save-and-quit',
  APP_DISCARD_AND_QUIT: 'app:discard-and-quit',
  ATTACHMENT_READ: 'attachment:read',
  DIALOG_PICK_DIRECTORY: 'dialog:pick-directory',
  REVIEW_START_DIRECTORY: 'review:start-directory',
  DIFF_EXPAND_CONTEXT: 'diff:expand-context',
  FIND_IN_PAGE: 'find:in-page',
  FIND_STOP: 'find:stop',
  FIND_RESULT: 'find:result',
} as const;
