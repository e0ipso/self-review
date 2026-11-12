// Builds the actual worker entry for source-only unit suites. Installed-package
// artifact checks separately exercise tsup output against external Core versions.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

export async function buildResumeTestWorker(output: string): Promise<void> {
  await build({
    entryPoints: [fileURLToPath(new URL('../resume-parser-worker.ts', import.meta.url))],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    alias: {
      '@self-review/core': fileURLToPath(
        new URL('../../../core/src/xml-parser.ts', import.meta.url)
      ),
    },
  });
}
