import { defineConfig, type Options } from 'tsup';

/** Where the committed bundle lives, relative to this package. */
export const STACK_BUNDLE_OUT_DIR = '../../.agents/skills/self-review-stack/scripts';
export const STACK_BUNDLE_FILE = 'stack.cjs';

const BANNER = [
  '#!/usr/bin/env node',
  '// Generated from packages/skill-scripts/src/stack; do not edit.',
  '// Rebuild with npm run build:skills --workspace @self-review/skill-scripts',
].join('\n');

/**
 * The stack helper as one self-contained CommonJS file that plain `node` runs from any
 * repository: every import, core's source included, is inlined. The output must be a pure
 * function of the source, because the staleness test rebuilds it into a temp directory
 * with these same options and compares bytes with the committed file. So: a fixed target
 * rather than the running Node's, no sourcemap, no timestamps, and never `clean`, which
 * would wipe the skill directory.
 */
export function stackBundleOptions(outDir: string): Options {
  return {
    entry: { stack: 'src/stack/cli.ts' },
    format: ['cjs'],
    platform: 'node',
    target: 'node20',
    bundle: true,
    noExternal: [/.*/],
    sourcemap: false,
    dts: false,
    splitting: false,
    clean: false,
    outDir,
    outExtension: () => ({ js: '.cjs' }),
    banner: { js: BANNER },
  };
}

export default defineConfig(stackBundleOptions(STACK_BUNDLE_OUT_DIR));
