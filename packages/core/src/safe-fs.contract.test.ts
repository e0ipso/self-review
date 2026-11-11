import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  atomicReplace,
  inspectReplaceTarget,
  nodeFsLayer,
  SafeFsError,
  snapshotIdentity,
} from './safe-fs';
import type { AtomicReplaceOptions } from './safe-fs';
import { atomicReplaceAsync, nodeAsyncFsLayer } from './safe-fs-async';
import type { AsyncFileHandle } from './safe-fs-async';

type Hooks = { write?: () => void; sync?: () => void; rename?: () => void; partial?: boolean };

/** Real handles with observable operation boundaries, rather than fakes that skip I/O policy. */
function observedHandle(handle: AsyncFileHandle, hooks: Hooks): AsyncFileHandle {
  return {
    stat: () => handle.stat(),
    read: (...args) => handle.read(...args),
    chmod: mode => handle.chmod(mode),
    chown: (uid, gid) => handle.chown(uid, gid),
    close: () => handle.close(),
    async write(bytes) {
      const result = await handle.write(hooks.partial ? bytes.subarray(0, 2) : bytes);
      hooks.write?.();
      return result;
    },
    async sync() {
      await handle.sync();
      hooks.sync?.();
    },
  };
}

const variants = [
  {
    name: 'sync',
    async replace(
      target: string,
      bytes: Buffer,
      options: Omit<AtomicReplaceOptions, 'fs'>,
      hooks: Hooks = {}
    ) {
      return atomicReplace(target, bytes, {
        ...options,
        fs: {
          ...nodeFsLayer,
          writeSync(fd, bytes) {
            const result = nodeFsLayer.writeSync(fd, hooks.partial ? bytes.subarray(0, 2) : bytes);
            hooks.write?.();
            return result;
          },
          fsyncSync(fd) {
            nodeFsLayer.fsyncSync(fd);
            hooks.sync?.();
          },
          renameSync(from, to) {
            nodeFsLayer.renameSync(from, to);
            hooks.rename?.();
          },
        },
      });
    },
  },
  {
    name: 'async',
    replace(
      target: string,
      bytes: Buffer,
      options: Omit<AtomicReplaceOptions, 'fs'>,
      hooks: Hooks = {}
    ) {
      return atomicReplaceAsync(target, bytes, {
        ...options,
        fs: {
          ...nodeAsyncFsLayer,
          async open(...args) {
            return observedHandle(await nodeAsyncFsLayer.open(...args), hooks);
          },
          async rename(from, to) {
            await nodeAsyncFsLayer.rename(from, to);
            hooks.rename?.();
          },
        },
      });
    },
  },
];

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-writer-contract-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

for (const variant of variants)
  describe(`${variant.name} replacement contract`, () => {
    it('writes every byte through partial writes and preserves mode and owner', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, 'old');
      fs.chmodSync(target, 0o640);
      const identity = inspectReplaceTarget(target)!;
      const result = await variant.replace(
        target,
        Buffer.from('é中\nnew'),
        {
          preserveMode: true,
          preserveOwner: true,
          expectedIdentity: identity,
          expectUnmodified: true,
        },
        { partial: true }
      );
      expect(fs.readFileSync(target)).toEqual(Buffer.from('é中\nnew'));
      expect(result.identity).toEqual(snapshotIdentity(fs.statSync(target)));
      expect(result.identity).toMatchObject({
        mode: identity.mode,
        uid: identity.uid,
        gid: identity.gid,
        nlink: 1,
      });
      expect(fs.readdirSync(root)).toEqual(['file']);
    });

    for (const phase of ['write', 'sync'] as const)
      for (const change of ['rewrite', 'replace'] as const) {
        it(`preserves ${change} during ${phase} and removes staging`, async () => {
          const target = path.join(root, 'file');
          fs.writeFileSync(target, 'old');
          const expectedIdentity = inspectReplaceTarget(target)!;
          let changed = false;
          const mutate = () => {
            if (changed) return;
            changed = true;
            if (change === 'replace') fs.renameSync(target, path.join(root, 'previous'));
            fs.writeFileSync(target, 'external modification');
          };
          await expect(
            variant.replace(
              target,
              Buffer.from('proposal'),
              {
                expectedIdentity,
                expectUnmodified: true,
              },
              { [phase]: mutate }
            )
          ).rejects.toMatchObject({ code: 'identity-changed' });
          expect(fs.readFileSync(target, 'utf8')).toBe('external modification');
          expect(fs.readdirSync(root).filter(name => name.endsWith('.tmp'))).toEqual([]);
        });
      }

    it('rejects a linked destination without touching its referent', async () => {
      const target = path.join(root, 'file');
      const other = path.join(root, 'other');
      fs.writeFileSync(other, 'keep');
      fs.symlinkSync(other, target);
      await expect(variant.replace(target, Buffer.from('new'), {})).rejects.toMatchObject({
        code: 'unsafe-link',
      });
      expect(fs.readFileSync(other, 'utf8')).toBe('keep');
    });

    it('preserves an existing name at the chosen temporary path', async () => {
      const target = path.join(root, 'file');
      const temp = path.join(root, '.file.fixed.tmp');
      fs.writeFileSync(target, 'old');
      fs.writeFileSync(temp, 'someone else');
      await expect(
        variant.replace(target, Buffer.from('new'), { randomName: () => 'fixed' })
      ).rejects.toMatchObject({ code: 'io-error' });
      expect(fs.readFileSync(target, 'utf8')).toBe('old');
      expect(fs.readFileSync(temp, 'utf8')).toBe('someone else');
    });

    it('preserves an external permissions change during staging', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, 'old');
      fs.chmodSync(target, 0o600);
      const expectedIdentity = inspectReplaceTarget(target)!;
      await expect(
        variant.replace(
          target,
          Buffer.from('new'),
          { expectedIdentity, preserveMode: true, expectUnmodified: true },
          {
            write() {
              fs.chmodSync(target, 0o640);
            },
          }
        )
      ).rejects.toMatchObject({ code: 'identity-changed' });
      expect(fs.statSync(target).mode & 0o777).toBe(0o640);
      expect(fs.readFileSync(target, 'utf8')).toBe('old');
      expect(fs.readdirSync(root)).toEqual(['file']);
    });

    it('cleans staging when final authorization refuses', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, 'old');
      await expect(
        variant.replace(target, Buffer.from('new'), {
          beforeCommit() {
            throw new SafeFsError('identity-changed', target, 'Authorization changed.');
          },
        })
      ).rejects.toMatchObject({ code: 'identity-changed' });
      expect(fs.readFileSync(target, 'utf8')).toBe('old');
      expect(fs.readdirSync(root)).toEqual(['file']);
    });

    it('keeps a committed result when directory sync fails', async () => {
      const target = path.join(root, 'file');
      let committed = false;
      const result = await variant.replace(
        target,
        Buffer.from('new'),
        {},
        {
          rename() {
            committed = true;
          },
          sync() {
            if (committed) throw new Error('directory sync unavailable');
          },
        }
      );
      expect(result.replaced).toBe(false);
      expect(fs.readFileSync(target, 'utf8')).toBe('new');
    });
  });

it('restores exact mode after asynchronous ownership preservation', async () => {
  const target = path.join(root, 'file');
  fs.writeFileSync(target, 'old');
  fs.chmodSync(target, 0o2640);
  await atomicReplaceAsync(target, Buffer.from('new'), {
    preserveOwner: true,
    preserveMode: true,
    fs: {
      ...nodeAsyncFsLayer,
      async lstat(value) {
        const stats = await nodeAsyncFsLayer.lstat(value);
        if (value === target) stats.gid += 1;
        return stats;
      },
      async open(...args) {
        const handle = await nodeAsyncFsLayer.open(...args);
        return {
          ...observedHandle(handle, {}),
          async chown() {
            const stats = await handle.stat();
            await handle.chmod(stats.mode & 0o777);
          },
        };
      },
    },
  });
  expect(fs.statSync(target).mode & 0o7777).toBe(0o2640);
});
