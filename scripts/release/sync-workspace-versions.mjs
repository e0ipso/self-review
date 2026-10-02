// semantic-release plugin, listed before @semantic-release/npm. npm links a
// workspace sibling only while the dependent's range accepts the sibling's
// version; otherwise it installs a stale copy from the registry, which is how
// 2.0.0 built @self-review/serve against @self-review/react 1.45.0. So every
// workspace takes the next version, and every sibling range that names a
// version moves to it, before npm reifies anything. `*` names no version and
// is left alone.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

async function readManifest(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function workspaceDirs(cwd, patterns) {
  const dirs = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('/*') && !pattern.slice(0, -2).includes('*')) {
      const parent = path.join(cwd, pattern.slice(0, -2));
      for (const entry of await readdir(parent, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(path.join(parent, entry.name));
      }
    } else if (!pattern.includes('*')) {
      dirs.push(path.join(cwd, pattern));
    } else {
      throw new Error(`Unsupported workspaces pattern: ${pattern}`);
    }
  }
  return dirs;
}

async function readWorkspaces(cwd) {
  const root = await readManifest(path.join(cwd, 'package.json'));
  const workspaces = [];
  for (const dir of await workspaceDirs(cwd, root.workspaces ?? [])) {
    const file = path.join(dir, 'package.json');
    try {
      workspaces.push({ file, manifest: await readManifest(file) });
    } catch (error) {
      // npm skips a directory without a manifest, so this does too.
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return workspaces;
}

export async function prepare(_pluginConfig, { cwd, nextRelease, logger }) {
  const { version } = nextRelease;
  const workspaces = await readWorkspaces(cwd);
  const names = new Set(workspaces.map(({ manifest }) => manifest.name));
  for (const { file, manifest } of workspaces) {
    manifest.version = version;
    for (const field of DEPENDENCY_FIELDS) {
      const deps = manifest[field] ?? {};
      for (const name of Object.keys(deps)) {
        if (names.has(name) && deps[name] !== '*') deps[name] = `^${version}`;
      }
    }
    await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
    logger.log('Set %s and its workspace dependencies to %s', manifest.name, version);
  }
}
