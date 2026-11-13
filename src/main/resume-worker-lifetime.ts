import type { Worker } from 'node:worker_threads';
import { runResumeWorker as runOwnedResumeWorker } from '../../packages/core/src/resume-worker';
import type { ResumeWorkerOptions } from '../../packages/core/src/resume-worker';
import { restoreResumeFailure } from './resume-worker-protocol';
import type { ResumeParseRequest } from './resume-worker-protocol';

export { checkResumeOwnership } from '../../packages/core/src/resume-worker';
export type { ResumeWorkerOptions } from '../../packages/core/src/resume-worker';

export function runResumeWorker(
  worker: Pick<Worker, 'on' | 'off' | 'postMessage' | 'terminate'>,
  request: ResumeParseRequest,
  options: ResumeWorkerOptions
) {
  return runOwnedResumeWorker(worker, request, options, restoreResumeFailure);
}
