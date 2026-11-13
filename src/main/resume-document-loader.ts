import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { realpath } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { adoptResumeDocument } from '../../packages/core/src/startup';
import type { ReviewSession } from '../../packages/core/src/review-session';
import { checkResumeOwnership, runResumeWorker } from './resume-worker-lifetime';
import type { ResumeWorkerOptions } from './resume-worker-lifetime';
import type { LocalSourcePaths } from '../../packages/core/src/source-identity';

const nativePaths: LocalSourcePaths = {
  async realpath(directory) {
    const absolute = resolve(directory);
    // Preserve the original native canonicalization's lexical fallback.
    return realpath(absolute).catch(() => absolute);
  },
};

/** Desktop startup operation. The matching worker entry is emitted beside Forge's main index.js. */
export function loadResumeDocumentAsync(
  session: ReviewSession,
  resumePath: string,
  options: ResumeWorkerOptions & { paths: LocalSourcePaths }
): Promise<ReturnType<typeof adoptResumeDocument>>;
export function loadResumeDocumentAsync(
  session: ReviewSession,
  resumePath: string,
  options?: ResumeWorkerOptions
): Promise<ReturnType<typeof adoptResumeDocument>>;
export async function loadResumeDocumentAsync(
  session: ReviewSession,
  resumePath: string,
  options: ResumeWorkerOptions & { paths?: LocalSourcePaths } = {}
) {
  checkResumeOwnership(options);
  const worker = new Worker(join(__dirname, 'resume-parser-worker.js'));
  const parsed = await runResumeWorker(worker, { id: randomUUID(), path: resumePath }, options);
  checkResumeOwnership(options);
  let documentDirectory: string;
  try {
    documentDirectory = await (options.paths ?? nativePaths).realpath(dirname(resumePath));
  } catch (error) {
    checkResumeOwnership(options);
    throw error;
  }
  checkResumeOwnership(options);
  return adoptResumeDocument(session, parsed, resumePath, {
    documentDirectory,
    signal: options.signal,
  });
}
