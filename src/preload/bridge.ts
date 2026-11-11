// Typed implementation of the flat preload bridge, with one subscription disposal contract.

import type { IpcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type { ElectronAPI } from '../shared/types';

export function createElectronAPI(
  ipcRenderer: Pick<IpcRenderer, 'on' | 'removeListener' | 'send' | 'invoke'>
): ElectronAPI {
  function subscribe<Args extends unknown[]>(
    channel: string,
    callback: (...args: Args) => void
  ): () => void {
    const handler = (_event: Electron.IpcRendererEvent, ...args: Args) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  }
  const api = {
    requestDiffData: () => {
      ipcRenderer.send(IPC.DIFF_REQUEST);
    },

    onDiffLoad: callback => subscribe(IPC.DIFF_LOAD, callback),

    requestConfig: () => {
      ipcRenderer.send(IPC.CONFIG_REQUEST);
    },

    onConfigLoad: callback => subscribe(IPC.CONFIG_LOAD, callback),

    requestResumeData: () => {
      ipcRenderer.send(IPC.RESUME_REQUEST);
    },

    onResumeLoad: callback => subscribe(IPC.RESUME_LOAD, callback),

    onGuideLoad: callback => subscribe(IPC.GUIDE_LOAD, callback),

    submitReview: state => {
      ipcRenderer.send(IPC.REVIEW_SUBMIT, state);
    },

    onCloseRequested: callback => subscribe(IPC.APP_CLOSE_REQUESTED, callback),

    saveAndQuit: () => {
      ipcRenderer.send(IPC.APP_SAVE_AND_QUIT);
    },

    handoffReview: state => ipcRenderer.invoke(IPC.REVIEW_HANDOFF, state),
    saveReview: state => ipcRenderer.invoke(IPC.REVIEW_SAVE, state),
    getSaveResult: () => ipcRenderer.invoke(IPC.REVIEW_SAVE_STATUS),
    acknowledgeReviewSave: receipt => ipcRenderer.send(IPC.REVIEW_SAVE_RECEIVED, receipt),
    onSaveFailed: callback => subscribe(IPC.REVIEW_SAVE_FAILED, callback),
    getApplicationLocale: () => ipcRenderer.invoke(IPC.APP_LOCALE),

    readAttachment: (filePath: string) => ipcRenderer.invoke(IPC.ATTACHMENT_READ, filePath),

    discardAndQuit: () => {
      ipcRenderer.send(IPC.APP_DISCARD_AND_QUIT);
    },

    pickDirectory: () => ipcRenderer.invoke(IPC.DIALOG_PICK_DIRECTORY),

    startDirectoryReview: (path: string) => ipcRenderer.invoke(IPC.REVIEW_START_DIRECTORY, path),

    expandContext: request => ipcRenderer.invoke(IPC.DIFF_EXPAND_CONTEXT, request),

    changeOutputPath: () => ipcRenderer.invoke(IPC.OUTPUT_PATH_CHANGE),

    onOutputPathChanged: callback => subscribe(IPC.OUTPUT_PATH_CHANGED, callback),

    findInPage: request => {
      ipcRenderer.send(IPC.FIND_IN_PAGE, request);
    },

    stopFindInPage: (action: string) => {
      ipcRenderer.send(IPC.FIND_STOP, action);
    },

    onFindResult: callback => subscribe(IPC.FIND_RESULT, callback),

    requestVersionUpdate: () => {
      ipcRenderer.send(IPC.VERSION_UPDATE_REQUEST);
    },

    onVersionUpdate: callback => subscribe(IPC.VERSION_UPDATE_AVAILABLE, callback),

    openExternal: (url: string) => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),

    loadFileContent: (filePath: string) => ipcRenderer.invoke(IPC.DIFF_LOAD_FILE, filePath),

    loadImage: (filePath: string) => ipcRenderer.invoke(IPC.DIFF_LOAD_IMAGE, filePath),

    openRemoteUrl: (url: string) => ipcRenderer.invoke(IPC.REMOTE_OPEN_URL, url),

    applySuggestion: request => ipcRenderer.invoke(IPC.SUGGESTION_APPLY, request),

    chooseApplyDestination: () => ipcRenderer.invoke(IPC.SUGGESTION_CHOOSE_DESTINATION),

    onShowAbout: callback => subscribe(IPC.APP_SHOW_ABOUT, callback),

    getAppInfo: () => ipcRenderer.invoke(IPC.APP_GET_INFO),
  } satisfies ElectronAPI;
  return api;
}
