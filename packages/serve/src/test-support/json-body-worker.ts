import { build } from 'esbuild';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { JsonBodyProcessing } from '../json-body-processing';

/** Real production entry built in durable test state, with no source-tree artifact. */
export async function buildJsonBodyTestWorker() {
  const state = join(
    process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'),
    'self-review-tests'
  );
  await mkdir(state, { recursive: true });
  const root = await mkdtemp(join(state, 'json-worker-'));
  const path = join(root, 'worker.mjs');
  await build({
    entryPoints: [fileURLToPath(new URL('../json-body-worker.ts', import.meta.url))],
    outfile: path,
    bundle: true,
    platform: 'node',
    format: 'esm',
  });
  return {
    path,
    processing: new JsonBodyProcessing(() => new Worker(path)),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
