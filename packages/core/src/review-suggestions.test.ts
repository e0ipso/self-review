import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  applySuggestionForSession,
  applySuggestionForSessionAsync,
  setApplyDestination,
} from './review-suggestions';
import { commitDiffData, createReviewSession } from './review-session';
import type { ReviewSession } from './review-session';
import type { SuggestionApplyRequest } from './types';
import { nodeAsyncFsLayer } from './safe-fs-async';
import { nodeFsLayer, type FsLayer } from './safe-fs';
import type { AsyncFsLayer } from './safe-fs-async';

let root: string;
beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-session-apply-')));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

function makeSession(sourceRoot = root, temporary = false): ReviewSession {
  const session = createReviewSession();
  commitDiffData(
    session,
    {
      files: [
        { oldPath: 'file', newPath: 'file', hunks: [], isBinary: false, changeType: 'modified' },
      ],
      source: { type: 'directory', sourcePath: sourceRoot },
      ...(temporary
        ? {
            remote: {
              temporaryClone: true,
              remoteForge: 'github' as const,
              remoteUrl: 'https://github.com/owner/repo/pull/1',
              remoteBaseSha: 'a',
              remoteHeadSha: 'b',
              threadSyncAvailable: false,
            },
          }
        : {}),
    },
    {
      mode: temporary ? 'remote' : 'directory',
      sourceRoot,
      invocationCwd: sourceRoot,
      gitDiffArgv: [],
      pathPrefix: '',
      oldSide: { kind: 'none' },
      newSide: { kind: 'directory' },
    }
  );
  return session;
}

function request(): SuggestionApplyRequest {
  return {
    filePath: 'file',
    lineRange: { side: 'new', start: 1, end: 1 },
    suggestion: { originalCode: 'old', proposedCode: 'new' },
  };
}

describe('temporary clone path components', () => {
  it.each(['..cache', '..cache/nested'])(
    'refuses a selected %s directory inside the clone',
    child => {
      const clone = path.join(root, 'clone');
      const destination = path.join(clone, child);
      fs.mkdirSync(destination, { recursive: true });
      const session = makeSession(clone, true);
      expect(setApplyDestination(session, destination)).toMatchObject({
        status: 'rejected',
        reason: 'destination-inside-temporary-clone',
      });
      expect(session.applyDestinationRoot).toBeNull();
    }
  );

  it('refuses a virtual alias into a dot-prefixed clone child', () => {
    const session = makeSession('/virtual/clone', true);
    expect(
      setApplyDestination(session, '/virtual/alias', {
        destinationInspection: {
          isDirectory: () => true,
          realpath: target => (target === '/virtual/alias' ? '/virtual/clone/..cache' : target),
        },
      })
    ).toMatchObject({ status: 'rejected', reason: 'destination-inside-temporary-clone' });
    expect(session.applyDestinationRoot).toBeNull();
  });

  it('refuses an unsafe directly assigned destination before async Apply writes', async () => {
    const clone = path.join(root, 'clone');
    const destination = path.join(clone, '..cache');
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'file'), 'old\n');
    const session = makeSession(clone, true);
    session.applyDestinationRoot = destination;
    expect(await applySuggestionForSessionAsync(session, request())).toMatchObject({
      status: 'refused',
    });
    expect(fs.readFileSync(path.join(destination, 'file'), 'utf8')).toBe('old\n');
    expect(fs.readdirSync(destination)).toEqual(['file']);
  });

  it('still accepts a dot-prefixed sibling outside the clone', () => {
    const clone = path.join(root, 'clone');
    const destination = path.join(root, '..cache');
    fs.mkdirSync(clone);
    fs.mkdirSync(destination);
    const session = makeSession(clone, true);
    expect(setApplyDestination(session, destination)).toEqual({
      status: 'chosen',
      destinationRoot: destination,
    });
  });
});

/** Run an action after staging has synced, before the final authorization check. */
function afterSync(action: () => void): AsyncFsLayer {
  return {
    ...nodeAsyncFsLayer,
    async open(...args) {
      const handle = await nodeAsyncFsLayer.open(...args);
      return {
        stat: () => handle.stat(),
        read: (...args) => handle.read(...args),
        write: bytes => handle.write(bytes),
        chmod: mode => handle.chmod(mode),
        chown: (uid, gid) => handle.chown(uid, gid),
        close: () => handle.close(),
        async sync() {
          await handle.sync();
          action();
        },
      };
    },
  };
}

describe('asynchronous session Apply', () => {
  it('returns the existing wire shape and projects the reviewed path', async () => {
    fs.mkdirSync(path.join(root, 'sub'));
    fs.writeFileSync(path.join(root, 'sub', 'file'), 'old\n');
    const session = makeSession();
    session.sourceIdentity!.pathPrefix = 'sub';
    expect(await applySuggestionForSessionAsync(session, request())).toEqual({
      status: 'applied',
      filePath: 'file',
      replacedLines: 1,
    });
    expect(fs.readFileSync(path.join(root, 'sub', 'file'), 'utf8')).toBe('new\n');
  });

  for (const change of [
    'identity',
    'identity-field',
    'membership',
    'destination',
    'review',
  ] as const) {
    it(`refuses if ${change} changes during staging`, async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, 'old\n');
      const session = makeSession();
      const layer = afterSync(() => {
        if (change === 'identity') session.sourceIdentity = { ...session.sourceIdentity! };
        if (change === 'identity-field') session.sourceIdentity!.pathPrefix = 'other';
        if (change === 'membership') session.reviewedPaths = new Set();
        if (change === 'destination') session.applyDestinationRoot = path.join(root, 'other');
        if (change === 'review') commitDiffData(session, session.diffData!, session.sourceIdentity);
      });
      expect(await applySuggestionForSessionAsync(session, request(), { fs: layer })).toMatchObject(
        { status: 'refused', reason: 'file-changed' }
      );
      expect(fs.readFileSync(target, 'utf8')).toBe('old\n');
      expect(fs.readdirSync(root)).toEqual(['file']);
    });
  }

  it('captures the request before awaits so caller mutation cannot redirect the action', async () => {
    const target = path.join(root, 'file');
    fs.writeFileSync(target, 'old\n');
    const session = makeSession();
    const input = request();
    const result = await applySuggestionForSessionAsync(session, input, {
      fs: {
        ...nodeAsyncFsLayer,
        async realpath(value) {
          input.filePath = '.git/config';
          input.suggestion.proposedCode = 'changed';
          input.lineRange!.start = 2;
          return nodeAsyncFsLayer.realpath(value);
        },
      },
    });
    expect(result).toEqual({ status: 'applied', filePath: 'file', replacedLines: 1 });
    expect(fs.readFileSync(target, 'utf8')).toBe('new\n');
  });

  it('requires a destination outside the temporary clone and bounds that destination independently', async () => {
    const clone = path.join(root, 'clone');
    const destination = path.join(root, 'destination');
    fs.mkdirSync(clone);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(clone, 'file'), 'old\n');
    fs.writeFileSync(path.join(destination, 'file'), 'old\nlarge\n');
    const session = makeSession(clone, true);
    expect(await applySuggestionForSessionAsync(session, request())).toMatchObject({
      status: 'refused',
      reason: 'destination-required',
    });
    expect(setApplyDestination(session, clone)).toMatchObject({
      status: 'rejected',
      reason: 'destination-inside-temporary-clone',
    });
    expect(setApplyDestination(session, destination)).toMatchObject({ status: 'chosen' });
    expect(
      await applySuggestionForSessionAsync(session, request(), { maxInputBytes: 8 })
    ).toMatchObject({ status: 'refused', reason: 'file-unreadable' });
    expect(fs.readFileSync(path.join(destination, 'file'), 'utf8')).toBe('old\nlarge\n');
    expect(fs.readFileSync(path.join(clone, 'file'), 'utf8')).toBe('old\n');
  });

  it('refuses a changed temporary-clone destination during staging', async () => {
    const clone = path.join(root, 'clone');
    const destination = path.join(root, 'destination');
    fs.mkdirSync(clone);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(destination, 'file'), 'old\n');
    const session = makeSession(clone, true);
    setApplyDestination(session, destination);
    expect(
      await applySuggestionForSessionAsync(session, request(), {
        fs: afterSync(() => {
          session.applyDestinationRoot = clone;
        }),
      })
    ).toMatchObject({ status: 'refused', reason: 'file-changed' });
    expect(fs.readFileSync(path.join(destination, 'file'), 'utf8')).toBe('old\n');
    expect(fs.readdirSync(destination)).toEqual(['file']);
  });

  it('refuses nonmembers and propagates cancellation without writing', async () => {
    fs.writeFileSync(path.join(root, 'file'), 'old\n');
    const session = makeSession();
    expect(
      await applySuggestionForSessionAsync(session, { ...request(), filePath: 'other' })
    ).toMatchObject({ status: 'refused', reason: 'not-reviewed' });
    const controller = new AbortController();
    const reason = new Error('cancel');
    await expect(
      applySuggestionForSessionAsync(session, request(), {
        signal: controller.signal,
        fs: afterSync(() => controller.abort(reason)),
      })
    ).rejects.toBe(reason);
    expect(fs.readFileSync(path.join(root, 'file'), 'utf8')).toBe('old\n');
    expect(fs.readdirSync(root)).toEqual(['file']);
  });
});

it('refuses a selected destination redirected into the temporary clone during resolution', async () => {
  const clone = path.join(root, 'clone');
  const destination = path.join(root, 'destination');
  const moved = path.join(root, 'moved');
  fs.mkdirSync(clone);
  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(clone, 'file'), 'old\n');
  fs.writeFileSync(path.join(destination, 'file'), 'old\n');
  const session = makeSession(clone, true);
  setApplyDestination(session, destination);
  let redirected = false;
  let staged = false;
  const result = await applySuggestionForSessionAsync(session, request(), {
    fs: {
      ...nodeAsyncFsLayer,
      async realpath(value) {
        if (value === destination && !redirected) {
          redirected = true;
          fs.renameSync(destination, moved);
          fs.symlinkSync(clone, destination);
        }
        return nodeAsyncFsLayer.realpath(value);
      },
      async open(value, flags, mode) {
        if ((flags & fs.constants.O_CREAT) !== 0) staged = true;
        return nodeAsyncFsLayer.open(value, flags, mode);
      },
    },
  });
  expect(result).toMatchObject({ status: 'refused', reason: 'file-changed' });
  expect(staged).toBe(false);
  expect(fs.readFileSync(path.join(clone, 'file'), 'utf8')).toBe('old\n');
  expect(fs.readFileSync(path.join(moved, 'file'), 'utf8')).toBe('old\n');
});

describe('suggestion effect dependencies', () => {
  it('selects a virtual destination using only supplied inspection and reports the old message', () => {
    const session = makeSession('/virtual/clone', true);
    const inspection = {
      isDirectory: vi.fn(() => true),
      realpath: vi.fn((value: string) =>
        value === '/virtual/alias' ? '/virtual/clone/sub' : value
      ),
    };
    const reportDiagnostic = vi.fn();
    expect(
      setApplyDestination(session, '/virtual/alias', {
        destinationInspection: inspection,
        reportDiagnostic,
      })
    ).toMatchObject({ status: 'rejected', reason: 'destination-inside-temporary-clone' });
    expect(
      setApplyDestination(session, '/virtual/output', {
        destinationInspection: inspection,
        reportDiagnostic,
      })
    ).toEqual({ status: 'chosen', destinationRoot: '/virtual/output' });
    expect(reportDiagnostic.mock.calls).toEqual([
      ['[suggestion:apply] destination set for this session'],
    ]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('isolates reporters from committed synchronous and asynchronous Apply results', async () => {
    const reportDiagnostic = vi.fn((_message: string) => {
      throw new Error('report failed');
    });
    const effects = { reportDiagnostic };
    const session = makeSession();
    fs.writeFileSync(path.join(root, 'file'), 'old\n');
    expect(applySuggestionForSession(session, request(), effects)).toEqual({
      status: 'applied',
      filePath: 'file',
      replacedLines: 1,
    });
    fs.writeFileSync(path.join(root, 'file'), 'old\n');
    const destinationInspection = {
      isDirectory: vi.fn(() => true),
      realpath: vi.fn((v: string) => v),
    };
    expect(
      await applySuggestionForSessionAsync(
        session,
        request(),
        {},
        {
          reportDiagnostic,
          destinationInspection,
        }
      )
    ).toEqual({ status: 'applied', filePath: 'file', replacedLines: 1 });
    expect(destinationInspection.realpath).toHaveBeenCalledWith(root);
    expect(reportDiagnostic.mock.calls).toEqual([
      ['[suggestion:apply] file: applied'],
      ['[suggestion:apply] file: applied'],
    ]);
    expect(fs.readFileSync(path.join(root, 'file'), 'utf8')).toBe('new\n');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('keeps default diagnostic call order and cancellation even when a reporter throws', async () => {
    const session = makeSession();
    fs.writeFileSync(path.join(root, 'file'), 'old\n');
    expect(applySuggestionForSession(session, { ...request(), filePath: 'other' })).toMatchObject({
      reason: 'not-reviewed',
    });
    expect(applySuggestionForSession(session, request())).toMatchObject({ status: 'applied' });
    expect(vi.mocked(console.error).mock.calls).toEqual([
      ['[suggestion:apply] other: refused (not-reviewed)'],
      ['[suggestion:apply] file: applied'],
    ]);
    const controller = new AbortController();
    const reason = new Error('cancelled by diagnostic');
    await expect(
      applySuggestionForSessionAsync(
        session,
        { ...request(), filePath: 'other' },
        {
          signal: controller.signal,
        },
        {
          reportDiagnostic() {
            controller.abort(reason);
            throw new Error('report failed');
          },
        }
      )
    ).rejects.toBe(reason);
  });
});

it('propagates cancellation from refused-result diagnostics and retains a committed Apply', async () => {
  for (const applied of [false, true]) {
    const session = makeSession();
    fs.writeFileSync(path.join(root, 'file'), applied ? 'old\n' : 'different\n');
    const controller = new AbortController();
    const reason = new Error('cancelled by result reporter');
    const result = applySuggestionForSessionAsync(
      session,
      request(),
      { signal: controller.signal },
      {
        reportDiagnostic() {
          controller.abort(reason);
          throw new Error('report failed');
        },
      }
    );
    if (applied)
      await expect(result).resolves.toEqual({
        status: 'applied',
        filePath: 'file',
        replacedLines: 1,
      });
    else await expect(result).rejects.toBe(reason);
    expect(fs.readFileSync(path.join(root, 'file'), 'utf8')).toBe(
      applied ? 'new\n' : 'different\n'
    );
  }
});

describe('synchronous session destination revalidation', () => {
  it('refuses a selected external directory redirected into the disposable clone before Apply', () => {
    const clone = path.join(root, 'clone');
    const destination = path.join(root, 'destination');
    const moved = path.join(root, 'moved');
    fs.mkdirSync(clone);
    fs.mkdirSync(destination);
    fs.writeFileSync(path.join(clone, 'file'), 'old\n');
    fs.writeFileSync(path.join(destination, 'file'), 'old\n');
    const session = makeSession(clone, true);
    expect(setApplyDestination(session, destination)).toMatchObject({ status: 'chosen' });
    fs.renameSync(destination, moved);
    fs.symlinkSync(clone, destination);
    expect(applySuggestionForSession(session, request())).toMatchObject({
      status: 'refused',
      reason: 'file-changed',
    });
    expect(fs.readFileSync(path.join(clone, 'file'), 'utf8')).toBe('old\n');
    expect(fs.readFileSync(path.join(moved, 'file'), 'utf8')).toBe('old\n');
    expect(fs.readdirSync(clone)).toEqual(['file']);
  });

  for (const stage of ['read', 'precommit'] as const) {
    for (const change of ['redirect', 'membership', 'identity', 'destination', 'review'] as const) {
      it(`refuses ${change} during ${stage} without replacing either source`, () => {
        const clone = path.join(root, 'clone');
        const destination = path.join(root, 'destination');
        const moved = path.join(root, 'moved');
        fs.mkdirSync(clone);
        fs.mkdirSync(destination);
        fs.writeFileSync(path.join(clone, 'file'), 'old\n');
        fs.writeFileSync(path.join(destination, 'file'), 'old\n');
        const session = makeSession(clone, true);
        setApplyDestination(session, destination);
        let changed = false;
        const mutate = () => {
          if (changed) return;
          changed = true;
          if (change === 'redirect') {
            fs.renameSync(destination, moved);
            fs.symlinkSync(clone, destination);
          }
          if (change === 'membership') session.reviewedPaths = new Set();
          if (change === 'identity') session.sourceIdentity!.pathPrefix = 'other';
          if (change === 'destination') session.applyDestinationRoot = clone;
          if (change === 'review')
            commitDiffData(session, session.diffData!, session.sourceIdentity);
        };
        vi.spyOn(nodeFsLayer, 'readSync').mockImplementation((...args) => {
          const bytes = fs.readSync(...args);
          if (stage === 'read') mutate();
          return bytes;
        });
        vi.spyOn(nodeFsLayer, 'fsyncSync').mockImplementation(fd => {
          fs.fsyncSync(fd);
          if (stage === 'precommit') mutate();
        });
        expect(applySuggestionForSession(session, request())).toMatchObject({
          status: 'refused',
        });
        expect(changed).toBe(true);
        expect(fs.readFileSync(path.join(clone, 'file'), 'utf8')).toBe('old\n');
        const external = change === 'redirect' ? moved : destination;
        expect(fs.readFileSync(path.join(external, 'file'), 'utf8')).toBe('old\n');
        if (change === 'redirect' && stage === 'precommit') {
          // Portable path-based cleanup cannot rediscover a parent moved by another actor.
          // The existing writer refuses replacement; its staged file moved with that parent.
          expect(fs.readdirSync(external)).toEqual([
            expect.stringMatching(/^\.file\.[a-f0-9]+\.tmp$/),
            'file',
          ]);
        } else expect(fs.readdirSync(external)).toEqual(['file']);
        expect(fs.readdirSync(clone)).toEqual(['file']);
      });
    }
  }

  it('applies into a safe dot-prefixed sibling through an authoritative legacy filesystem', () => {
    const clone = '/__virtual_clone__';
    const virtual = '/__virtual_..cache__';
    fs.writeFileSync(path.join(root, 'file'), 'old\n');
    const mapPath = (target: string) =>
      target === virtual
        ? root
        : target.startsWith(virtual + '/')
          ? root + target.slice(virtual.length)
          : target;
    const descriptors = new Map<number, number>();
    let next = 1000000;
    const layer: FsLayer & { calls: number } = {
      calls: 0,
      realpathSync(target) {
        this.calls++;
        return target;
      },
      lstatSync(target) {
        this.calls++;
        return nodeFsLayer.lstatSync(mapPath(target));
      },
      openSync(target, flags, mode) {
        this.calls++;
        const fd = next++;
        descriptors.set(fd, nodeFsLayer.openSync(mapPath(target), flags, mode));
        return fd;
      },
      closeSync(fd) {
        this.calls++;
        nodeFsLayer.closeSync(descriptors.get(fd)!);
        descriptors.delete(fd);
      },
      fstatSync(fd) {
        this.calls++;
        return nodeFsLayer.fstatSync(descriptors.get(fd)!);
      },
      readFileSync(fd) {
        this.calls++;
        return nodeFsLayer.readFileSync(descriptors.get(fd)!);
      },
      writeSync(fd, bytes) {
        this.calls++;
        return nodeFsLayer.writeSync(descriptors.get(fd)!, bytes);
      },
      fsyncSync(fd) {
        this.calls++;
        nodeFsLayer.fsyncSync(descriptors.get(fd)!);
      },
      fchmodSync(fd, mode) {
        this.calls++;
        nodeFsLayer.fchmodSync(descriptors.get(fd)!, mode);
      },
      fchownSync(fd, uid, gid) {
        this.calls++;
        nodeFsLayer.fchownSync(descriptors.get(fd)!, uid, gid);
      },
      renameSync(from, to) {
        this.calls++;
        nodeFsLayer.renameSync(mapPath(from), mapPath(to));
      },
      unlinkSync(target) {
        this.calls++;
        nodeFsLayer.unlinkSync(mapPath(target));
      },
      mkdirSync(target, mode) {
        this.calls++;
        nodeFsLayer.mkdirSync(mapPath(target), mode);
      },
    };
    const session = makeSession(clone, true);
    expect(
      setApplyDestination(session, virtual, {
        destinationInspection: {
          realpath: value => layer.realpathSync(value),
          isDirectory: value => layer.lstatSync(value).isDirectory(),
        },
      })
    ).toMatchObject({ status: 'chosen' });
    expect(applySuggestionForSession(session, request(), { fs: layer })).toEqual({
      status: 'applied',
      filePath: 'file',
      replacedLines: 1,
    });
    expect(layer.calls).toBeGreaterThan(0);
    expect(descriptors.size).toBe(0);
    expect(fs.readFileSync(path.join(root, 'file'), 'utf8')).toBe('new\n');
  });
});
