import { spawnSync } from 'child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'tsup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STACK_BUNDLE_FILE, STACK_BUNDLE_OUT_DIR, stackBundleOptions } from '../../tsup.config';
import { gitSync, withoutGitRepoEnv } from '../../../core/src/test-support/git-env';

const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COMMITTED_BUNDLE = path.join(PACKAGE_DIR, STACK_BUNDLE_OUT_DIR, STACK_BUNDLE_FILE);
const STALE_MESSAGE =
  'stack.cjs is stale: run npm run build:skills --workspace @self-review/skill-scripts';

const scratch: string[] = [];

function scratchDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

function readOrNull(file: string): Buffer | null {
  try {
    return readFileSync(file);
  } catch {
    return null;
  }
}

let originalCwd: string;

beforeAll(() => {
  // tsup resolves the tsconfig and esbuild writes its `// path` comments relative to the
  // working directory, so the fresh build must run where `npm run build:skills` does.
  originalCwd = process.cwd();
  process.chdir(PACKAGE_DIR);
});

afterAll(() => {
  process.chdir(originalCwd);
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

describe('stack.cjs bundle', () => {
  it('matches a fresh build of the source', async () => {
    const outDir = scratchDir('skill-scripts-build-');
    await build({ ...stackBundleOptions(outDir), config: false, silent: true });

    const fresh = readFileSync(path.join(outDir, STACK_BUNDLE_FILE));
    const committed = readOrNull(COMMITTED_BUNDLE);
    expect(committed !== null && fresh.equals(committed), STALE_MESSAGE).toBe(true);
  }, 60_000);

  describe('copied alone outside the repository', () => {
    let bundle: string;
    let repo: string;

    beforeAll(() => {
      bundle = path.join(scratchDir('skill-scripts-bundle-'), STACK_BUNDLE_FILE);
      copyFileSync(COMMITTED_BUNDLE, bundle);
      repo = scratchDir('skill-scripts-repo-');
      gitSync(['init', '-q'], { cwd: repo });
    });

    function runBundle(args: string[]) {
      return spawnSync(process.execPath, [bundle, ...args], {
        cwd: repo,
        encoding: 'utf-8',
        env: withoutGitRepoEnv(),
      });
    }

    it('describes the sides of a staged diff with no node_modules in reach', () => {
      const result = runBundle(['resolve', '--staged']);

      expect(result.stderr).toBe('');
      expect(result.stdout).toBe('old: revision\nnew: index\n');
      expect(result.status).toBe(0);
    });

    it('refuses an unknown subcommand with usage on stderr', () => {
      const result = runBundle(['frobnicate']);

      expect(result.stdout).toBe('');
      expect(result.stderr).toMatch(/^usage: stack\.cjs /m);
      expect(result.status).toBe(2);
    });
  });
});
