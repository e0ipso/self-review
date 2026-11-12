import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { preparePayload } from '../../packages/core/src/review-handlers';
import { checkContentBudget } from './content-budget';
import type {
  DiffLoadPayload,
  AppConfig,
  OutputPathInfo,
  ResumeLoadPayload,
  GuideLoadPayload,
} from '../shared/types';
export function sendDiffLoad(window: BrowserWindow, payload: DiffLoadPayload): void {
  window.webContents.send(IPC.DIFF_LOAD, prepareDiffLoad(payload));
}

/** Check metadata before allocating file projections. Retained hunks are not wire data in lazy mode. */
export function prepareDiffLoad(payload: DiffLoadPayload): DiffLoadPayload {
  checkContentBudget(payload, payload.isLargePayload);
  const wire = preparePayload(payload);
  checkContentBudget(wire);
  return wire;
}

/** Validation returns the same reference; only diff projection makes transport copies. */
export function prepareContent<T>(value: T): T {
  checkContentBudget(value);
  return value;
}

export function prepareResumeLoad(payload: ResumeLoadPayload | null): ResumeLoadPayload {
  if (payload === undefined) throw new Error('The host did not acknowledge saved feedback.');
  return prepareContent(payload ?? { comments: [], viewedFiles: [] });
}

/** Validate the complete diff/guide delivery before sending its first message. */
export function prepareDiffDelivery(payload: DiffLoadPayload, guide: GuideLoadPayload | null) {
  const diff = prepareDiffLoad(payload);
  prepareContent(guide);
  return { diff, guide };
}

export function sendConfigLoad(
  window: BrowserWindow,
  config: AppConfig,
  outputPathInfo?: OutputPathInfo
): void {
  prepareContent({ config, outputPathInfo });
  window.webContents.send(IPC.CONFIG_LOAD, config, outputPathInfo);
}

export function sendResumeLoad(window: BrowserWindow, payload: ResumeLoadPayload): void {
  window.webContents.send(IPC.RESUME_LOAD, prepareResumeLoad(payload));
}

export function sendGuideLoad(window: BrowserWindow, payload: GuideLoadPayload): void {
  window.webContents.send(IPC.GUIDE_LOAD, prepareContent(payload));
}
