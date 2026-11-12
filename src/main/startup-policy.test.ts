import { build } from 'esbuild';
import { expect, it } from 'vitest';

it('loads supplied startup orchestration without Electron presentation or default startup selection', async () => {
  const result = await build({
    entryPoints: ['src/main/startup-policy.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    metafile: true,
  });
  const loaded = Object.keys(result.metafile.inputs);
  expect(loaded).not.toContain('src/main/presentation.ts');
  expect(loaded).not.toContain('src/main/startup-operations.ts');
  expect(loaded).not.toContain('packages/core/src/remote-mode.ts');
  expect(loaded).not.toContain('packages/core/src/review-handlers.ts');
  expect(result.outputFiles[0].text).not.toMatch(/from ["']electron["']/);
});
