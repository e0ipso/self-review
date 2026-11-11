import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { preparePayload } from '../../packages/core/src/review-handlers';
import type {
  DiffLoadPayload,
  AppConfig,
  OutputPathInfo,
  ResumeLoadPayload,
  GuideLoadPayload,
} from '../shared/types';
export function sendDiffLoad(window: BrowserWindow, payload: DiffLoadPayload): void {
  window.webContents.send(IPC.DIFF_LOAD, preparePayload(payload));
}

export function sendConfigLoad(
  window: BrowserWindow,
  config: AppConfig,
  outputPathInfo?: OutputPathInfo
): void {
  window.webContents.send(IPC.CONFIG_LOAD, config, outputPathInfo);
}

export function sendResumeLoad(window: BrowserWindow, payload: ResumeLoadPayload): void {
  window.webContents.send(IPC.RESUME_LOAD, payload);
}

export function sendGuideLoad(window: BrowserWindow, payload: GuideLoadPayload): void {
  window.webContents.send(IPC.GUIDE_LOAD, payload);
}
