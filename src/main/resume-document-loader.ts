import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { adoptResumeDocument } from '../../packages/core/src/startup';
import type { ReviewSession } from '../../packages/core/src/review-session';
import { checkResumeOwnership, runResumeWorker } from './resume-worker-lifetime';
import type { ResumeWorkerOptions } from './resume-worker-lifetime';

/** Desktop startup operation. The matching worker entry is emitted beside Forge's main index.js. */
export async function loadResumeDocumentAsync(
  session: ReviewSession,
  resumePath: string,
  options: ResumeWorkerOptions = {}
) {
  checkResumeOwnership(options);
  const worker = new Worker(join(__dirname, 'resume-parser-worker.js'));
  const parsed = await runResumeWorker(worker, { id: randomUUID(), path: resumePath }, options);
  checkResumeOwnership(options);
  return adoptResumeDocument(session, parsed, resumePath);
}
