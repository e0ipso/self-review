// src/preload/preload.ts
// Preload script - exposes ElectronAPI to renderer via contextBridge

import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import {
  DiffLoadPayload,
  ResumeLoadPayload,
  AppConfig,
  OutputPathInfo,
  ReviewState,
  ExpandContextRequest,
  FindInPageRequest,
  FindInPageResult,
  VersionUpdateInfo,
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

  onConfigLoad: (callback: (payload: AppConfig, outputPathInfo?: OutputPathInfo) => void) => {
    ipcRenderer.on(IPC.CONFIG_LOAD, (_event, payload: AppConfig, outputPathInfo?: OutputPathInfo) =>
      callback(payload, outputPathInfo)
    );
  },

  requestResumeData: () => {
    ipcRenderer.send(IPC.RESUME_REQUEST);
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
    const handler = () => callback();
    ipcRenderer.on(IPC.APP_CLOSE_REQUESTED, handler);
    return () => ipcRenderer.removeListener(IPC.APP_CLOSE_REQUESTED, handler);
  },

  saveAndQuit: () => {
    ipcRenderer.send(IPC.APP_SAVE_AND_QUIT);
  },

  readAttachment: (filePath: string) =>
    ipcRenderer.invoke(IPC.ATTACHMENT_READ, filePath),

  discardAndQuit: () => {
    ipcRenderer.send(IPC.APP_DISCARD_AND_QUIT);
  },

  pickDirectory: () => ipcRenderer.invoke(IPC.DIALOG_PICK_DIRECTORY),

  startDirectoryReview: (path: string) =>
    ipcRenderer.invoke(IPC.REVIEW_START_DIRECTORY, path),

  expandContext: (request: ExpandContextRequest) =>
    ipcRenderer.invoke(IPC.DIFF_EXPAND_CONTEXT, request),

  changeOutputPath: () => ipcRenderer.invoke(IPC.OUTPUT_PATH_CHANGE),

  onOutputPathChanged: (callback: (info: OutputPathInfo) => void) => {
    ipcRenderer.on(IPC.OUTPUT_PATH_CHANGED, (_event, info: OutputPathInfo) =>
      callback(info)
    );
  },

  findInPage: (request: FindInPageRequest) => {
    ipcRenderer.send(IPC.FIND_IN_PAGE, request);
  },

  stopFindInPage: (action: string) => {
    ipcRenderer.send(IPC.FIND_STOP, action);
  },

  onFindResult: (callback: (result: FindInPageResult) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: FindInPageResult) =>
      callback(result);
    ipcRenderer.on(IPC.FIND_RESULT, handler);
    return () => ipcRenderer.removeListener(IPC.FIND_RESULT, handler);
  },

  onVersionUpdate: (callback: (info: VersionUpdateInfo) => void) => {
    ipcRenderer.on(IPC.VERSION_UPDATE_AVAILABLE, (_event, info: VersionUpdateInfo) =>
      callback(info)
    );
  },

  openExternal: (url: string) => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),
});
