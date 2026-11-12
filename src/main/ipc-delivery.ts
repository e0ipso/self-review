import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { preparePayload } from '../../packages/core/src/review-handlers';
import { checkContentBudget, checkContentBudgetAsync } from './content-budget';
import { setImmediate } from 'node:timers/promises';
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

/** Cooperative preparation retains all host references; only the wire projection is copied. */
export async function prepareDiffLoadAsync(
  payload: DiffLoadPayload,
  assertCurrent: () => void
): Promise<DiffLoadPayload> {
  await checkContentBudgetAsync(payload, payload.isLargePayload, assertCurrent);
  const files: DiffLoadPayload['files'] = [];
  for (let offset = 0; offset < payload.files.length; offset += 256) {
    assertCurrent();
    const part = preparePayload({ ...payload, files: payload.files.slice(offset, offset + 256) });
    files.push(...part.files);
    if (offset + 256 < payload.files.length) {
      await setImmediate();
      assertCurrent();
    }
  }
  const wire = { ...payload, files };
  await checkContentBudgetAsync(wire, false, assertCurrent);
  return wire;
}

export async function prepareContentAsync<T>(value: T, assertCurrent: () => void): Promise<T> {
  await checkContentBudgetAsync(value, false, assertCurrent);
  return value;
}

export async function prepareResumeLoadAsync(
  payload: ResumeLoadPayload | null,
  assertCurrent: () => void
): Promise<ResumeLoadPayload> {
  if (payload === undefined) throw new Error('The host did not acknowledge saved feedback.');
  return prepareContentAsync(payload ?? { comments: [], viewedFiles: [] }, assertCurrent);
}

export async function prepareDiffDeliveryAsync(
  payload: DiffLoadPayload,
  guide: GuideLoadPayload | null,
  assertCurrent: () => void
) {
  const diff = await prepareDiffLoadAsync(payload, assertCurrent);
  await prepareContentAsync(guide, assertCurrent);
  return { diff, guide };
}
