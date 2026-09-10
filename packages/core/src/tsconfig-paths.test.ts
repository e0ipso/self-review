// Guards the workspace type mapping: that every tsconfig which compiles code
// importing `@self-review/types` resolves it to the package source rather than
// to a build artifact.
//
// This has to be asserted on the config text, because no compile can fail over
// it. `packages/types/dist` is a real directory on any machine that has ever
// built the workspace, so the bare package name resolves through node_modules
// whether or not the mapping is there, and `npm run typecheck:tests` passes
// either way, against yesterday's declarations (SR-0068).

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '../../..');

const TYPES_ENTRY = path.join(REPO_ROOT, 'packages/types/src/index.ts');

/**
 * The tsconfigs that must carry the mapping. The types package's own config
 * is exempt: it compiles the source the others point at, and mapping the
 * package to itself would be circular.
 */
const EXEMPT = 'packages/types/tsconfig.json';

/** Every tsconfig in the workspace, in the two places they are allowed to sit. */
function findTsconfigs(): string[] {
  const found = ['tsconfig.json', 'tests/tsconfig.json'];
  const packagesDir = path.join(REPO_ROOT, 'packages');
  for (const entry of fs.readdirSync(packagesDir).sort()) {
    const relative = path.join('packages', entry, 'tsconfig.json');
    if (fs.existsSync(path.join(REPO_ROOT, relative))) found.push(relative);
  }
  return found.filter(relative => fs.existsSync(path.join(REPO_ROOT, relative)));
}

/** Parse a tsconfig, comments and all, as TypeScript itself reads it. */
function readCompilerOptions(relativePath: string): {
  baseUrl?: string;
  paths?: Record<string, string[]>;
} {
  const absolute = path.join(REPO_ROOT, relativePath);
  const parsed = ts.parseConfigFileTextToJson(absolute, fs.readFileSync(absolute, 'utf-8'));
  expect(parsed.error).toBeUndefined();
  // Nothing in this workspace extends another config, so the options a file
  // declares are the options it compiles with.
  expect(parsed.config.extends).toBeUndefined();
  return parsed.config.compilerOptions ?? {};
}

const MAPPED = findTsconfigs().filter(relative => relative !== EXEMPT);

describe('@self-review/types path mapping', () => {
  it('is declared by every workspace tsconfig but the types package itself', () => {
    // Pinned so a new package cannot join the workspace with a config that
    // silently resolves the types package to its dist output.
    expect(MAPPED).toEqual([
      'tsconfig.json',
      'tests/tsconfig.json',
      'packages/core/tsconfig.json',
      'packages/react/tsconfig.json',
      'packages/serve/tsconfig.json',
    ]);
    expect(fs.existsSync(path.join(REPO_ROOT, EXEMPT))).toBe(true);
  });

  it.each(MAPPED)('%s resolves @self-review/types to packages/types/src/index.ts', relative => {
    const options = readCompilerOptions(relative);
    const substitutions = options.paths?.['@self-review/types'];

    expect(substitutions).toBeDefined();
    expect(substitutions).toHaveLength(1);

    // Without `baseUrl`, TypeScript resolves a substitution against the
    // directory of the config that declares it.
    const base = options.baseUrl
      ? path.resolve(REPO_ROOT, path.dirname(relative), options.baseUrl)
      : path.resolve(REPO_ROOT, path.dirname(relative));

    expect(path.resolve(base, substitutions![0])).toBe(TYPES_ENTRY);
  });

  it('points at a file that exists', () => {
    expect(fs.existsSync(TYPES_ENTRY)).toBe(true);
  });
});
