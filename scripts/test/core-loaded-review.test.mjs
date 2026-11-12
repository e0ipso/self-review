import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const require = createRequire(import.meta.url);
for (const format of ['esm', 'cjs']) {
  const load = name => (format === 'esm' ? import(name) : Promise.resolve(require(name)));
  for (const entry of ['@self-review/core', '@self-review/core/operations']) {
    test(`${format} ${entry} captures survive root/operations handoff`, async t => {
      const core = await load('@self-review/core');
      const operations = await load(entry);
      const directory = await mkdtemp(join(tmpdir(), 'core-loaded-consumer-'));
      t.after(() => rm(directory, { recursive: true, force: true }));
      await writeFile(join(directory, 'image.png'), Buffer.from([0, 255, 128]));
      const loaded = await operations.loadLocalReview(
        { mode: 'directory', sourcePath: directory },
        [],
        { ignore: [] },
        directory,
        () => {}
      );
      assert.equal(core.commitDiffData.length, 3);
      assert.equal(core.commitReviewStart.length, 3);
      const session = core.createReviewSession();
      core.commitLoadedReview(session, loaded.payload, loaded.loadedReview);
      assert.equal(session.diffData, loaded.payload);
      assert.equal(session.sourceIdentity, loaded.identity);
      assert.equal(core.loadedReviewIdentity(loaded.loadedReview), loaded.identity);
      assert.deepEqual([...core.loadedReviewPaths(loaded.loadedReview)], ['image.png']);
      assert.equal(JSON.stringify(loaded.loadedReview), '{}');
      assert.throws(
        () => core.loadedReviewIdentity({ ...loaded.loadedReview }),
        /LoadedReview capability/
      );
      assert.equal(
        (await core.readLoadedReviewContent(loaded.loadedReview, 'image.png', 'new')).ok,
        true
      );
      assert.equal('loadedReview' in core.getDiffLoad(session).diff, false);
      await writeFile(join(directory, 'image.png'), Buffer.from([0, 1, 2, 3]));
      assert.equal(
        (await core.readLoadedReviewContent(loaded.loadedReview, 'image.png', 'new')).ok,
        false
      );
      // Original old-call identity remains captured across bundled entry aliases.
      operations.commitDiffData(session, loaded.payload, loaded.identity);
      assert.equal((await core.readReviewedContent(session, 'image.png', 'new')).ok, false);
      // A copied logical identity explicitly takes the old live structural route.
      operations.commitDiffData(session, loaded.payload, { ...loaded.identity });
      assert.deepEqual(
        (await core.readReviewedContent(session, 'image.png', 'new')).content,
        await readFile(join(directory, 'image.png'))
      );
      loaded.identity.pathPrefix = 'still mutable';
      loaded.payload.isLargePayload = true;
      assert.equal(loaded.identity.pathPrefix, 'still mutable');
      assert.equal(loaded.payload.isLargePayload, true);
    });
  }
  test(`${format} exact index OIDs survive restaging with old and explicit calls`, async t => {
    const core = await load('@self-review/core');
    const operations = await load('@self-review/core/operations');
    const directory = await mkdtemp(join(tmpdir(), 'core-index-consumer-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const git = (...args) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    git('init', '-q', '-b', 'main');
    await writeFile(join(directory, 'image.png'), Buffer.from([0, 255, 128]));
    git('add', 'image.png');
    const loaded = await operations.loadLocalReview(
      { mode: 'git' },
      ['--cached'],
      { ignore: [] },
      directory,
      () => {}
    );
    await writeFile(join(directory, 'image.png'), Buffer.from([0, 1, 2, 3]));
    git('add', 'image.png');
    const session = core.createReviewSession();
    for (const commit of [
      () => operations.commitDiffData(session, loaded.payload, loaded.identity),
      () => core.commitLoadedReview(session, loaded.payload, loaded.loadedReview),
    ]) {
      commit();
      assert.deepEqual(await core.readReviewedContent(session, 'image.png', 'new'), {
        ok: true,
        content: Buffer.from([0, 255, 128]),
      });
    }
  });
}
