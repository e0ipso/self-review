import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inspectOutputPath,
  inspectOutputPathAsync,
  nodeOutputPathInspection,
  ReviewPublishError,
} from './operations';
import type { OutputPathInspection } from './operations';
import { SafeFsError } from './safe-fs';

let root: string;
let output: string;
beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'output-inspection-')));
  output = join(root, 'review.xml');
});
afterEach(() => {
  fs.chmodSync(root, 0o755);
  fs.rmSync(root, { force: true, recursive: true });
  vi.restoreAllMocks();
});

const shape = (error: ReviewPublishError | null) =>
  error && { name: error.name, code: error.code, path: error.path, message: error.message };

describe.each(['explicit', 'inherited'] as const)('%s native inspection', origin => {
  const options = () =>
    origin === 'explicit' ? { outputOrigin: origin } : { outputOrigin: origin, baseDir: root };
  it.each([
    'missing',
    'regular',
    'directory',
    'symlink',
    'hardlink',
    'fifo',
    'missing parent',
    'read-only parent',
    'read-only leaf',
  ])('matches synchronous policy for %s', async scenario => {
    switch (scenario) {
      case 'regular':
        fs.writeFileSync(output, 'old');
        break;
      case 'directory':
        fs.mkdirSync(output);
        break;
      case 'symlink':
        fs.symlinkSync(join(root, 'elsewhere'), output);
        break;
      case 'hardlink':
        fs.writeFileSync(join(root, 'other'), 'old');
        fs.linkSync(join(root, 'other'), output);
        break;
      case 'fifo':
        execFileSync('mkfifo', [output]);
        break;
      case 'missing parent':
        output = join(root, 'missing', 'review.xml');
        break;
      case 'read-only parent':
        fs.chmodSync(root, 0o555);
        break;
      case 'read-only leaf':
        fs.writeFileSync(output, 'old', { mode: 0o400 });
        break;
    }
    const sync = inspectOutputPath(output, options());
    const asynchronous = await inspectOutputPathAsync(output, options());
    if (origin === 'inherited' && scenario === 'missing parent') {
      // Node's sync realpath reports lstat, while its async implementation reports realpath.
      expect(asynchronous).toMatchObject({ code: sync!.code, path: sync!.path });
      expect(asynchronous!.message).toContain(`Cannot resolve ${join(root, 'missing')}: ENOENT:`);
    } else expect(shape(asynchronous)).toEqual(shape(sync));
    if (scenario === 'read-only leaf') expect(fs.statSync(output).mode & 0o777).toBe(0o400);
  });
});

it('checks physical containment through a linked parent like the sync API', async () => {
  const base = join(root, 'launch');
  fs.mkdirSync(base);
  fs.symlinkSync(root, join(base, 'outside'));
  output = join(base, 'outside', 'review.xml');
  const options = { outputOrigin: 'inherited' as const, baseDir: base };
  expect(shape(await inspectOutputPathAsync(output, options))).toEqual(
    shape(inspectOutputPath(output, options))
  );
  expect((await inspectOutputPathAsync(output, options))?.code).toBe('unsafe-link');
  expect(await inspectOutputPathAsync(output, { outputOrigin: 'explicit' })).toBeNull();
});

function virtualInspection(): OutputPathInspection {
  const inspection: OutputPathInspection = {
    async realpath(target) {
      expect(this).toBe(inspection);
      return target.replace('/virtual', '/physical');
    },
    async lstat(target) {
      expect(this).toBe(inspection);
      expect(target).toBe('/virtual/review.xml');
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    },
    async isWritable(directory) {
      expect(this).toBe(inspection);
      expect(directory).toBe('/virtual');
      return true;
    },
  };
  return inspection;
}

it('uses only the authoritative virtual filesystem and preserves receivers', async () => {
  const inspection = virtualInspection();
  expect(
    await inspectOutputPathAsync('/virtual/review.xml', {
      outputOrigin: 'inherited',
      baseDir: '/virtual',
      inspection,
    })
  ).toBeNull();
  inspection.isWritable = async () => false;
  expect(
    (await inspectOutputPathAsync('/virtual/review.xml', { outputOrigin: 'explicit', inspection }))
      ?.code
  ).toBe('permission-denied');
});

it.each(['realpath', 'lstat', 'isWritable'] as const)(
  'preserves typed %s errors without retry',
  async method => {
    const inspection = virtualInspection();
    const error = new ReviewPublishError('io-error', '/virtual', 'injected');
    inspection[method] = vi.fn().mockRejectedValue(error);
    expect(
      await inspectOutputPathAsync('/virtual/review.xml', {
        outputOrigin: 'inherited',
        baseDir: '/virtual',
        inspection,
      })
    ).toBe(error);
    expect(inspection[method]).toHaveBeenCalledTimes(1);
  }
);

it('keeps filesystem failure classification and cause', async () => {
  const inspection = virtualInspection();
  const error = new SafeFsError('unsafe-link', '/virtual/review.xml', 'link');
  inspection.lstat = async () => {
    throw error;
  };
  const result = await inspectOutputPathAsync('/virtual/review.xml', {
    outputOrigin: 'explicit',
    inspection,
  });
  expect(result).toMatchObject({ code: 'unsafe-link', cause: error });
});

it.each(['realpath', 'lstat', 'isWritable'] as const)(
  'joins an admitted %s probe before rejecting cancellation',
  async method => {
    const inspection = virtualInspection();
    const controller = new AbortController();
    const reason = new Error('cancel');
    let settle!: () => void;
    let entered!: () => void;
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    const gate = new Promise<never>((_resolve, reject) => {
      settle = () => reject(new Error('probe finished'));
    });
    inspection[method] = vi.fn(() => {
      entered();
      return gate;
    });
    let finished = false;
    const result = inspectOutputPathAsync('/virtual/review.xml', {
      outputOrigin: 'inherited',
      baseDir: '/virtual',
      inspection,
      signal: controller.signal,
    });
    const observed = result.then(
      value => {
        finished = true;
        return { value };
      },
      error => {
        finished = true;
        return { error };
      }
    );
    await started;
    controller.abort(reason);
    await new Promise<void>(resolve => setImmediate(resolve));
    const finishedBeforeSettlement = finished;
    settle();
    const outcome = await observed;
    expect(finishedBeforeSettlement).toBe(false);
    expect(outcome).toEqual({ error: reason });
    if ('error' in outcome) expect(outcome.error).toBe(reason);
  }
);

it('refuses a legacy provider instead of silently inspecting native paths', async () => {
  const options = { outputOrigin: 'explicit' as const, fs: {} };
  // JavaScript callers can pass the old option bag; the new role must be explicit.
  // @ts-expect-error legacy synchronous effects are not asynchronous inspection effects
  expect((await inspectOutputPathAsync(output, options))?.code).toBe('io-error');
});

it('does not start a probe after pre-cancellation', async () => {
  const inspection = virtualInspection();
  inspection.lstat = vi.fn(inspection.lstat);
  const controller = new AbortController();
  const reason = new Error('cancel');
  controller.abort(reason);
  await expect(
    inspectOutputPathAsync(output, {
      outputOrigin: 'explicit',
      inspection,
      signal: controller.signal,
    })
  ).rejects.toBe(reason);
  expect(inspection.lstat).not.toHaveBeenCalled();
});

it.each([true, false])(
  'checks cancellation after final probe delivery: writable %s',
  async writable => {
    const inspection = virtualInspection();
    const controller = new AbortController();
    const reason = new Error('cancel at delivery');
    inspection.isWritable = () => {
      const result = Promise.resolve(writable);
      void result.then(() => queueMicrotask(() => controller.abort(reason)));
      return result;
    };
    await expect(
      inspectOutputPathAsync('/virtual/review.xml', {
        outputOrigin: 'explicit',
        inspection,
        signal: controller.signal,
      })
    ).rejects.toBe(reason);
  }
);
