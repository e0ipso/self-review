import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const install = require('electron-installer-redhat');
const name = 'self-review-rpm-fixture';

// Run with RPM 6, matching the Ubuntu 26.04 release runner. The small
// Electron-shaped fixture exercises staging without bundling the app.
for (const arch of ['x86_64', 'aarch64']) {
  test(`RPM packaging preserves the application and launcher for ${arch}`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'self-review-rpm-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const src = join(root, 'app');
    await mkdir(join(src, 'resources/app'), { recursive: true });
    await writeFile(
      join(src, 'resources/app/package.json'),
      JSON.stringify({
        name,
        version: '1.0.0',
        description: 'RPM packaging regression fixture',
        license: 'MIT',
        author: { name: 'Test', email: 'test@example.com' },
      })
    );
    await writeFile(join(src, 'version'), '44.5.1');
    await writeFile(join(src, 'LICENSE'), 'MIT\n');
    await writeFile(join(src, name), '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const { packagePaths } = await install({
      src,
      dest: join(root, 'rpm'),
      arch,
      bin: name,
      icon: fileURLToPath(new URL('../../assets/icon.png', import.meta.url)),
    });
    assert.equal(packagePaths.length, 1);
    const [rpm] = packagePaths;
    const files = execFileSync('rpm', ['-qpl', rpm], { encoding: 'utf8' }).split('\n');
    assert.ok(files.includes(`/usr/bin/${name}`));
    assert.ok(files.includes(`/usr/lib/${name}/resources/app/package.json`));
    assert.equal(execFileSync('rpm', ['-qp', '--qf', '%{ARCH}', rpm], { encoding: 'utf8' }), arch);
    assert.equal(
      execFileSync('rpm', ['-qp', '--qf', '%{RPMFORMAT}', rpm], { encoding: 'utf8' }),
      '4'
    );
  });
}
