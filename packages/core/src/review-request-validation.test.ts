import { describe, expect, it, vi } from 'vitest';
import { decodeSuggestionApplyRequest } from './review-request-validation';
import { expandContext } from './review-context';
import { loadImage, readAttachment } from './review-content';
import { loadLocalReview } from './startup';
import { createReviewSession, commitDiffData } from './review-session';
import { parseDiff } from './diff-parser';
import { CommandCancelledError } from './forge-provider';
import type { AppConfig } from './types';

const raw = 'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-before\n+after\n';
const request = {
  filePath: 'a.txt',
  lineRange: { side: 'new', start: 0, end: -1 },
  suggestion: { originalCode: 'before', proposedCode: 'after' },
};

describe('transport-neutral request structure', () => {
  it.each([
    null,
    { side: 'new', start: 0, end: -1 },
    { side: 'old', start: 2.5, end: 1 },
    { side: 'new', start: NaN, end: Infinity },
  ])('leaves anchor usability to the engine: %j', lineRange => {
    const body = { ...request, lineRange, extension: { retained: true } };
    expect(decodeSuggestionApplyRequest(body)).toEqual({ ok: true, value: body });
  });
  it.each([
    null,
    [],
    { ...request, lineRange: [] },
    { ...request, lineRange: { side: 'other', start: 1, end: 2 } },
    { ...request, lineRange: { side: 'new', start: '1', end: 2 } },
    { ...request, suggestion: [] },
    { ...request, suggestion: { originalCode: null, proposedCode: 'a' } },
  ])('rejects malformed containers and primitives: %j', body => {
    expect(decodeSuggestionApplyRequest(body).ok).toBe(false);
  });
});

function session() {
  const state = createReviewSession();
  commitDiffData(
    state,
    { files: parseDiff(raw), source: { type: 'git', repository: '/review', gitDiffArgs: '' } },
    {
      mode: 'git',
      sourceRoot: '/review',
      invocationCwd: '/review',
      gitDiffArgv: [],
      pathPrefix: '',
      oldSide: { kind: 'index' },
      newSide: { kind: 'working-tree' },
    }
  );
  return state;
}

describe('shared request cancellation', () => {
  it('forwards expansion cancellation and drops a late successful runner result', async () => {
    const state = session();
    const original = state.diffData;
    const controller = new AbortController();
    let resolve!: (raw: string) => void;
    const runDiff = vi.fn(
      () =>
        new Promise<string>(done => {
          resolve = done;
        })
    );
    const readContent = vi.fn();
    const pending = expandContext(
      state,
      { filePath: 'a.txt', contextLines: 3 },
      { runDiff, readContent, report: vi.fn() },
      { signal: controller.signal, timeoutMs: 20 }
    );
    expect(runDiff).toHaveBeenCalledWith(expect.any(Array), '/review', {
      signal: controller.signal,
      timeoutMs: 20,
    });
    controller.abort();
    resolve(raw);
    await expect(pending).rejects.toBeInstanceOf(CommandCancelledError);
    expect(readContent).not.toHaveBeenCalled();
    expect(state.diffData).toBe(original);
  });

  it('propagates typed runner cancellation instead of successful null', async () => {
    const reason = new CommandCancelledError('timeout', 'git', []);
    await expect(
      expandContext(
        session(),
        { filePath: 'a.txt', contextLines: 3 },
        { runDiff: vi.fn().mockRejectedValue(reason), readContent: vi.fn(), report: vi.fn() }
      )
    ).rejects.toBe(reason);
  });

  it('refuses cancelled loading and attachment reads before effects', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadLocalReview(
        { mode: 'directory', sourcePath: '/missing' },
        [],
        {} as AppConfig,
        '/missing',
        vi.fn(),
        { signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(CommandCancelledError);
    await expect(
      readAttachment(createReviewSession(), '.self-review-assets/a.png', {
        signal: controller.signal,
      })
    ).rejects.toBeInstanceOf(CommandCancelledError);
  });

  it('forwards image snapshot cancellation', async () => {
    const state = session();
    state.reviewedPaths = new Set([...state.reviewedPaths, 'a.png']);
    const controller = new AbortController();
    controller.abort();
    await expect(loadImage(state, 'a.png', { signal: controller.signal })).rejects.toBeInstanceOf(
      CommandCancelledError
    );
  });
});
