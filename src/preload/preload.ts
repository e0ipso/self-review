// src/preload/preload.ts
// Preload script - exposes ElectronAPI to renderer via contextBridge

import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import {
  DiffLoadPayload,
  ResumeLoadPayload,
  AppConfig,
  ReviewState,
} from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  requestDiffData: () => {
    ipcRenderer.send(IPC.DIFF_REQUEST);
  },

  onDiffLoad: (callback: (payload: DiffLoadPayload) => void) => {
    ipcRenderer.on(IPC.DIFF_LOAD, (_event, payload: DiffLoadPayload) =>
      callback(payload)
    );
  },

  requestConfig: () => {
    ipcRenderer.send(IPC.CONFIG_REQUEST);
  },

  onConfigLoad: (callback: (payload: AppConfig) => void) => {
    ipcRenderer.on(IPC.CONFIG_LOAD, (_event, payload: AppConfig) =>
      callback(payload)
    );
  },

  requestResumeData: () => {
    ipcRenderer.send('resume:request');
  },

  onResumeLoad: (callback: (payload: ResumeLoadPayload) => void) => {
    ipcRenderer.on(IPC.RESUME_LOAD, (_event, payload: ResumeLoadPayload) =>
      callback(payload)
    );
  },

  submitReview: (state: ReviewState) => {
    ipcRenderer.send(IPC.REVIEW_SUBMIT, state);
  },

  onRequestReview: (callback: () => void) => {
    ipcRenderer.on('review:request', () => callback());
  },

  onCloseRequested: (callback: () => void) => {
    ipcRenderer.on(IPC.APP_CLOSE_REQUESTED, () => callback());
  },

  saveAndQuit: () => {
    ipcRenderer.send(IPC.APP_SAVE_AND_QUIT);
  },

  readAttachment: (filePath: string) =>
    ipcRenderer.invoke(IPC.ATTACHMENT_READ, filePath),

  discardAndQuit: () => {
    ipcRenderer.send(IPC.APP_DISCARD_AND_QUIT);
  },
});
