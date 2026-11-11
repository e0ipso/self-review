import { afterEach, beforeEach, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySuggestion } from './apply-suggestion';
import { nodeFsLayer, type FsLayer } from './safe-fs';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(join(tmpdir(), 'apply-legacy-fs-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

/** A previous FsLayer can own descriptors that have no meaning to node:fs. */
function legacyFilesystem(onRead = () => {}) {
  let next = 1_000_000;
  const descriptors = new Map<number, number>();
  const actual = (fd: number) => {
    const value = descriptors.get(fd);
    if (value === undefined) throw new Error('Unknown virtual descriptor');
    return value;
  };
  const layer: FsLayer = {
    openSync(target, flags, mode) {
      const fd = next++;
      descriptors.set(fd, nodeFsLayer.openSync(target, flags, mode));
      return fd;
    },
    closeSync(fd) {
      nodeFsLayer.closeSync(actual(fd));
      descriptors.delete(fd);
    },
    fstatSync: fd => nodeFsLayer.fstatSync(actual(fd)),
    readFileSync(fd) {
      onRead();
      return nodeFsLayer.readFileSync(actual(fd));
    },
    writeSync: (fd, bytes) => nodeFsLayer.writeSync(actual(fd), bytes),
    fsyncSync: fd => nodeFsLayer.fsyncSync(actual(fd)),
    fchmodSync: (fd, mode) => nodeFsLayer.fchmodSync(actual(fd), mode),
    fchownSync: (fd, uid, gid) => nodeFsLayer.fchownSync(actual(fd), uid, gid),
    renameSync: nodeFsLayer.renameSync,
    unlinkSync: nodeFsLayer.unlinkSync,
    lstatSync: nodeFsLayer.lstatSync,
    mkdirSync: nodeFsLayer.mkdirSync,
    realpathSync: nodeFsLayer.realpathSync,
  };
  return { layer, descriptors };
}

function apply(layer: FsLayer, maxInputBytes = 4) {
  return applySuggestion(
    {
      destinationRoot: root,
      filePath: 'file',
      lineRange: { side: 'new', start: 1, end: 1 },
      suggestion: { originalCode: 'old', proposedCode: 'new' },
    },
    { fs: layer, maxInputBytes }
  );
}

it('preserves valid Apply calls through a legacy virtual-descriptor filesystem', () => {
  fs.writeFileSync(join(root, 'file'), 'old\n');
  let reads = 0;
  const { layer, descriptors } = legacyFilesystem(() => reads++);
  expect(apply(layer)).toMatchObject({ status: 'applied' });
  expect(fs.readFileSync(join(root, 'file'), 'utf8')).toBe('new\n');
  expect(reads).toBe(1);
  expect(descriptors.size).toBe(0);
});

it('refuses an oversized legacy file before calling its reader', () => {
  fs.writeFileSync(join(root, 'file'), 'old\nrest');
  let reads = 0;
  const { layer, descriptors } = legacyFilesystem(() => reads++);
  expect(apply(layer)).toMatchObject({
    status: 'refused',
    reason: 'file-unreadable',
    detail: expect.stringContaining('4 byte Apply input limit'),
  });
  expect(reads).toBe(0);
  expect(descriptors.size).toBe(0);
  expect(fs.readFileSync(join(root, 'file'), 'utf8')).toBe('old\nrest');
  expect(fs.readdirSync(root)).toEqual(['file']);
});

it('refuses growth returned by a legacy reader without staging or overwriting the change', () => {
  fs.writeFileSync(join(root, 'file'), 'old\n');
  const { layer, descriptors } = legacyFilesystem(() => {
    fs.writeFileSync(join(root, 'file'), 'old\nx');
  });
  expect(apply(layer)).toMatchObject({
    status: 'refused',
    reason: 'file-unreadable',
    detail: expect.stringContaining('4 byte Apply input limit'),
  });
  expect(descriptors.size).toBe(0);
  expect(fs.readFileSync(join(root, 'file'), 'utf8')).toBe('old\nx');
  expect(fs.readdirSync(root)).toEqual(['file']);
});
