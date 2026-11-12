import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { ReviewSession } from '@self-review/core';
import { installedServeEngine } from './engine-contract';
import { checkResumeOwnership, runResumeWorker } from './resume-worker-lifetime';
import type { ResumeWorkerOptions } from './resume-worker-lifetime';
import type { LocalSourcePaths } from '../../core/src/source-identity';
import { adoptResumeAtDirectory } from './resume-adoption-compatibility';

const nativePaths: LocalSourcePaths = {
  async realpath(directory) {
    const absolute = resolve(directory);
    // Preserve the original native canonicalization's lexical fallback.
    return realpath(absolute).catch(() => absolute);
  },
};
const createParserWorker = () => new Worker(new URL('./resume-parser-worker.js', import.meta.url));

async function parseResume(path: string, options: ResumeWorkerOptions, worker: () => Worker) {
  checkResumeOwnership(options);
  const parsed = await runResumeWorker(worker(), { id: randomUUID(), path }, options);
  checkResumeOwnership(options);
  return parsed;
}

/** The entry is emitted beside cli.js; no cwd or desktop dependency. */
export function createResumeLoader(
  adopt = installedServeEngine.adoptResume,
  createWorker = createParserWorker
) {
  return async (session: ReviewSession, path: string, options: ResumeWorkerOptions = {}) => {
    const parsed = await parseResume(path, options, createWorker);
    checkResumeOwnership(options);
    return adopt(session, parsed, path);
  };
}

export function loadResumeDocumentAsync(
  session: ReviewSession,
  path: string,
  options: ResumeWorkerOptions & { paths: LocalSourcePaths }
): Promise<Awaited<ReturnType<typeof parseResume>>>;
export function loadResumeDocumentAsync(
  session: ReviewSession,
  path: string,
  options?: ResumeWorkerOptions
): Promise<Awaited<ReturnType<typeof parseResume>>>;
export async function loadResumeDocumentAsync(
  session: ReviewSession,
  path: string,
  options: ResumeWorkerOptions & { paths?: LocalSourcePaths } = {}
) {
  const parsed = await parseResume(path, options, createParserWorker);
  let directory: string;
  try {
    directory = await (options.paths ?? nativePaths).realpath(dirname(path));
  } catch (error) {
    checkResumeOwnership(options);
    throw error;
  }
  checkResumeOwnership(options);
  return adoptResumeAtDirectory(session, parsed, directory);
}
