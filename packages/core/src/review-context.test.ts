import { describe, it, expect, vi } from 'vitest';
import { parseDiff } from './diff-parser';
import { createReviewSession, commitDiffData } from './review-session';
import { expandContext } from './review-context';
import type { ContextExpansionDependencies } from './review-context';
import type { SnapshotReadResult } from './snapshot-reader';
import type { ReviewSourceIdentity } from './types';

function diff(file = 'a.txt', context = false): string {
  return `diff --git a/${file} b/${file}
--- a/${file}
+++ b/${file}
${context ? '@@ -1,2 +1,2 @@\n context' : '@@ -2 +2 @@'}
-before
+after
`;
}

function session() {
  const session = createReviewSession();
  const identity: ReviewSourceIdentity = {
    mode: 'git',
    sourceRoot: '/review',
    invocationCwd: '/review',
    gitDiffArgv: [],
    pathPrefix: '',
    oldSide: { kind: 'index' },
    newSide: { kind: 'working-tree' },
  };
  commitDiffData(
    session,
    {
      files: [...parseDiff(diff()), ...parseDiff(diff('b.txt'))],
      source: { type: 'git', repository: '/review', gitDiffArgs: '' },
    },
    identity
  );
  return session;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  return {
    promise: new Promise<T>(done => {
      resolve = done;
    }),
    resolve: (value: T) => resolve(value),
  };
}

function dependencies(): ContextExpansionDependencies {
  return {
    runDiff: vi.fn(async () => diff('a.txt', true)),
    readContent: vi.fn<ContextExpansionDependencies['readContent']>(async () => ({
      ok: true,
      content: Buffer.from('context\nafter\n'),
    })),
    report: vi.fn(),
  };
}

const request = { filePath: 'a.txt', contextLines: 20 };

describe('context expansion dependency contract', () => {
  it('drops a git result from a replaced review without reading its content', async () => {
    const state = session();
    const deps = dependencies();
    const pending = deferred<string>();
    deps.runDiff = vi.fn(() => pending.promise);
    const result = expandContext(state, request, deps);
    const replacement = { ...state.diffData!, files: parseDiff(diff('other.txt')) };
    commitDiffData(state, replacement, state.sourceIdentity);
    pending.resolve(diff('a.txt', true));
    expect(await result).toBeNull();
    expect(deps.readContent).not.toHaveBeenCalled();
    expect(state.diffData).toBe(replacement);
  });

  it('drops a late snapshot read even when a recommit reuses payload and identity objects', async () => {
    const state = session();
    const deps = dependencies();
    const pending = deferred<SnapshotReadResult>();
    deps.readContent = vi.fn(() => pending.promise);
    const payload = state.diffData!;
    const reviewedPaths = state.reviewedPaths;
    const sourceIdentity = state.sourceIdentity;
    const result = expandContext(state, request, deps);
    await vi.waitFor(() => expect(deps.readContent).toHaveBeenCalledOnce());
    expect(deps.readContent).toHaveBeenCalledWith(
      { reviewedPaths, sourceIdentity },
      'a.txt',
      'new',
      expect.objectContaining({ maxBytes: expect.any(Number) })
    );
    commitDiffData(state, payload, sourceIdentity);
    expect(state.reviewedPaths).not.toBe(reviewedPaths);
    pending.resolve({ ok: true, content: Buffer.from('context\nafter\n') });
    expect(await result).toBeNull();
    expect(state.diffData).toBe(payload);
  });

  it('merges overlapping file expansions into the current payload', async () => {
    const state = session();
    const deps = dependencies();
    const a = deferred<string>();
    const b = deferred<string>();
    deps.runDiff = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const resultA = expandContext(state, request, deps);
    const resultB = expandContext(state, { ...request, filePath: 'b.txt' }, deps);
    a.resolve(diff('a.txt', true));
    expect(await resultA).toMatchObject({ totalLines: 2 });
    b.resolve(diff('b.txt', true));
    expect(await resultB).toMatchObject({ totalLines: 2 });
    expect(state.diffData!.files.map(file => file.hunks[0].newStart)).toEqual([1, 1]);
  });

  it('reports an unreadable snapshot and preserves expanded hunks with an unknown line count', async () => {
    const state = session();
    const deps = dependencies();
    deps.readContent = vi.fn<ContextExpansionDependencies['readContent']>(async () => ({
      ok: false,
      reason: 'read-failed',
      message: 'unavailable',
    }));
    expect(await expandContext(state, request, deps)).toMatchObject({ totalLines: 0 });
    expect(state.diffData!.files[0].hunks[0].newStart).toBe(1);
    expect(deps.report).toHaveBeenCalledWith(expect.stringContaining('unavailable'));
  });

  it('reports a rejected runner without modifying the session', async () => {
    const state = session();
    const deps = dependencies();
    const payload = state.diffData;
    const failure = new Error('runner failed');
    deps.runDiff = vi.fn(async () => {
      throw failure;
    });
    expect(await expandContext(state, request, deps)).toBeNull();
    expect(state.diffData).toBe(payload);
    expect(deps.report).toHaveBeenCalledWith(expect.stringContaining('Failed to expand'), failure);
  });
});
