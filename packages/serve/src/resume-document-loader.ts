import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import type { ReviewSession } from '@self-review/core';
import { installedServeEngine } from './engine-contract';
import { checkResumeOwnership, runResumeWorker } from './resume-worker-lifetime';
import type { ResumeWorkerOptions } from './resume-worker-lifetime';

/** The entry is emitted beside cli.js; no cwd or desktop dependency. */
export function createResumeLoader(
  adopt = installedServeEngine.adoptResume,
  createWorker = () => new Worker(new URL('./resume-parser-worker.js', import.meta.url))
) {
  return async (session: ReviewSession, path: string, options: ResumeWorkerOptions = {}) => {
    checkResumeOwnership(options);
    const parsed = await runResumeWorker(createWorker(), { id: randomUUID(), path }, options);
    checkResumeOwnership(options);
    // Installed Core owns origin authorization; bounded synchronous metadata
    // inspection during adoption remains on the host thread.
    return adopt(session, parsed, path);
  };
}
export const loadResumeDocumentAsync = createResumeLoader();
