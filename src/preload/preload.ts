// src/preload/preload.ts
// Preload script - exposes ElectronAPI to renderer via contextBridge

import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { DiffLoadPayload, ResumeLoadPayload, AppConfig, ReviewState } from '../shared/types';

contextBridge.exposeInMainWorld('electronAPI', {
  onDiffLoad: (callback: (payload: DiffLoadPayload) => void) => {
    ipcRenderer.on(IPC.DIFF_LOAD, (_event, payload: DiffLoadPayload) => callback(payload));
  },

  onResumeLoad: (callback: (payload: ResumeLoadPayload) => void) => {
    ipcRenderer.on(IPC.RESUME_LOAD, (_event, payload: ResumeLoadPayload) => callback(payload));
  },

  onConfigLoad: (callback: (payload: AppConfig) => void) => {
    ipcRenderer.on(IPC.CONFIG_LOAD, (_event, payload: AppConfig) => callback(payload));
  },

  submitReview: (state: ReviewState) => {
    ipcRenderer.send(IPC.REVIEW_SUBMIT, state);
  },

  onRequestReview: (callback: () => void) => {
    ipcRenderer.on('review:request', () => callback());
  },
});
