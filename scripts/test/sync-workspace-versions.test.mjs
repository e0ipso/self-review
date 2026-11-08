// Regression checks for scripts/release/sync-workspace-versions.mjs, run
// against throwaway workspaces with no network and no semantic-release run.
//
// Usage: node --test scripts/test/sync-workspace-versions.test.mjs

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { prepare } from '../release/sync-workspace-versions.mjs';

const dirs = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function repo(root, packages) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'sync-workspace-versions-'));
  dirs.push(cwd);
  await writeJson(path.join(cwd, 'package.json'), root);
  for (const [dir, manifest] of Object.entries(packages)) {
    await writeJson(path.join(cwd, dir, 'package.json'), manifest);
  }
  return cwd;
}

async function run(cwd, version) {
  await prepare({}, { cwd, nextRelease: { version }, logger: { log() {} } });
}

async function manifest(cwd, dir) {
  return JSON.parse(await readFile(path.join(cwd, dir, 'package.json'), 'utf8'));
}

// The shape this repository had at 2.0.0.
const ROOT = { name: '@e0ipso/self-review', version: '2.0.0', workspaces: ['packages/*'] };
const PACKAGES = {
  'packages/types': { name: '@self-review/types', version: '2.0.0' },
  'packages/core': {
    name: '@self-review/core',
    version: '2.0.0',
    dependencies: { '@self-review/types': '*', yaml: '^2.8.2' },
  },
  'packages/react': {
    name: '@self-review/react',
    version: '2.0.0',
    dependencies: { '@self-review/types': '*' },
    devDependencies: { '@self-review/core': '*' },
  },
  'packages/serve': {
    name: '@self-review/serve',
    version: '2.0.0',
    dependencies: { '@self-review/core': '^1.44.0', '@self-review/react': '^1.44.0' },
    devDependencies: { tsup: '^8.0.0' },
  },
};

test('moves every workspace and each version-naming sibling range to the release', async () => {
  const cwd = await repo(ROOT, PACKAGES);
  await run(cwd, '3.0.0');

  for (const dir of Object.keys(PACKAGES)) {
    assert.equal((await manifest(cwd, dir)).version, '3.0.0', dir);
  }
  const serve = await manifest(cwd, 'packages/serve');
  assert.deepEqual(serve.dependencies, {
    '@self-review/core': '^3.0.0',
    '@self-review/react': '^3.0.0',
  });
  assert.deepEqual(serve.devDependencies, { tsup: '^8.0.0' });
});

test('leaves `*` ranges, outside packages and the root manifest alone', async () => {
  const cwd = await repo(ROOT, PACKAGES);
  await run(cwd, '3.0.0');

  assert.deepEqual((await manifest(cwd, 'packages/core')).dependencies, {
    '@self-review/types': '*',
    yaml: '^2.8.2',
  });
  assert.deepEqual((await manifest(cwd, 'packages/react')).devDependencies, {
    '@self-review/core': '*',
  });
  // @semantic-release/npm owns the root version.
  assert.equal((await manifest(cwd, '.')).version, '2.0.0');
});

test('moves sibling peer and optional ranges too', async () => {
  const cwd = await repo(ROOT, {
    'packages/a': { name: 'a', version: '1.0.0' },
    'packages/b': {
      name: 'b',
      version: '1.0.0',
      peerDependencies: { a: '^1.0.0' },
      optionalDependencies: { a: '~1.0.0' },
    },
  });
  await run(cwd, '1.1.0');

  const b = await manifest(cwd, 'packages/b');
  assert.deepEqual(b.peerDependencies, { a: '^1.1.0' });
  assert.deepEqual(b.optionalDependencies, { a: '^1.1.0' });
});

test('keeps npm formatting and key order', async () => {
  const cwd = await repo(ROOT, PACKAGES);
  await run(cwd, '2.0.1');

  const text = await readFile(path.join(cwd, 'packages/serve/package.json'), 'utf8');
  const expected = structuredClone(PACKAGES['packages/serve']);
  expected.version = '2.0.1';
  expected.dependencies = { '@self-review/core': '^2.0.1', '@self-review/react': '^2.0.1' };
  assert.equal(text, `${JSON.stringify(expected, null, 2)}\n`);
});

test('skips a workspace directory without a manifest, as npm does', async () => {
  const cwd = await repo(ROOT, PACKAGES);
  await mkdir(path.join(cwd, 'packages/scratch'));
  await run(cwd, '2.0.1');

  assert.equal((await manifest(cwd, 'packages/types')).version, '2.0.1');
});

test('refuses a workspaces pattern it cannot expand', async () => {
  const cwd = await repo({ ...ROOT, workspaces: ['packages/**'] }, PACKAGES);
  await assert.rejects(run(cwd, '2.0.1'), /Unsupported workspaces pattern: packages\/\*\*/);
});
