import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);

for (const format of ['esm', 'cjs']) {
  const load = name => (format === 'esm' ? import(name) : Promise.resolve(require(name)));

  test(`${format} entry points share public error classes`, async () => {
    const core = await load('@self-review/core');
    const operations = await load('@self-review/core/operations');
    const filesystem = await load('@self-review/core/filesystem');
    assert.equal(operations.ReviewPublishError, core.ReviewPublishError);
    assert.equal(filesystem.SafeFsError, core.SafeFsError);
    const error = new filesystem.SafeFsError('io-error', '/review', 'read failed');
    assert.ok(error instanceof core.SafeFsError);
  });

  test(`${format} publication failures match the original root contract`, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'core-entry-contract-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const core = await load('@self-review/core');
    const operations = await load('@self-review/core/operations');
    await assert.rejects(
      operations.publishReview(JSON.parse('null'), join(directory, 'review.xml'), {}),
      error => error instanceof core.ReviewPublishError && error.code === 'validation-failed'
    );
  });
}
