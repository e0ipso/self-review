import React, { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  DiffFile,
  DiffLoadPayload,
  ResumeLoadPayload,
  ReviewComment,
} from '@self-review/types';
import type { ReviewAdapter } from '../adapter';
import { ReviewAdapterProvider } from './ReviewAdapterContext';
import { ConfigProvider } from './ConfigContext';
import {
  ReviewProvider,
  useReview,
  useReviewSaveTransaction,
  type ReviewContextValue,
} from './ReviewContext';
import CommentDisplay from '../components/Comments/CommentDisplay';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();

const base = 'a'.repeat(40);
const firstHead = 'b'.repeat(40);
const nextHead = 'c'.repeat(40);
function file(path = 'f.ts', text = ['alpha', 'beta']): DiffFile {
  return {
    oldPath: path,
    newPath: path,
    changeType: 'added',
    isBinary: false,
    hunks: [
      {
        header: `@@ -0,0 +1,${text.length} @@`,
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: text.length,
        lines: text.map((content, i) => ({
          type: 'addition',
          oldLineNumber: null,
          newLineNumber: i + 1,
          content,
        })),
      },
    ],
  };
}
function payload(head = firstHead, files = [file()]): DiffLoadPayload {
  return {
    files,
    source: { type: 'git', repository: '/clone', gitDiffArgs: `${base}...${head}` },
    remote: {
      remoteUrl: 'https://github.com/owner/repo/pull/7',
      remoteForge: 'github',
      remoteBaseSha: base,
      remoteHeadSha: head,
      temporaryClone: false,
      threadSyncAvailable: true,
    },
  };
}
function thread(id: string, line: number | null = null): ReviewComment {
  return {
    id,
    filePath: 'f.ts',
    lineRange: line ? { side: 'new', start: line, end: line } : null,
    body: `Human ${id}`,
    category: 'bug',
    suggestion: line
      ? { originalCode: line === 1 ? 'alpha' : 'beta', proposedCode: 'fixed' }
      : null,
    replies: [{ id: `${id}-reply`, body: 'Human reply' }],
    attachments: [{ id: `${id}-attachment`, mediaType: 'image/png', fileName: 'asset.png' }],
    author: 'Reviewer',
    severity: 'major',
    confidence: 'high',
    remoteId: `remote-${id}`,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}
function fixture(initial = payload(), options: Partial<ReviewAdapter> = {}, display = false) {
  let push!: (value: DiffLoadPayload) => void;
  let resume!: (value: ResumeLoadPayload) => void;
  let review!: ReviewContextValue;
  let begin!: ReturnType<typeof useReviewSaveTransaction>['begin'];
  const adapter: ReviewAdapter = {
    loadDiff: async () => initial,
    onDiffLoad: cb => {
      push = cb;
      return () => {};
    },
    onResumeLoad: cb => {
      resume = cb;
      return () => {};
    },
    ...options,
  };
  function Probe() {
    review = useReview();
    begin = useReviewSaveTransaction().begin;
    return display ? (
      <>
        {review.files.flatMap(f => f.comments.map(c => <CommentDisplay key={c.id} comment={c} />))}
      </>
    ) : null;
  }
  const content = (host = adapter) => (
    <StrictMode>
      <ReviewAdapterProvider adapter={host}>
        <ConfigProvider>
          <ReviewProvider>
            <Probe />
          </ReviewProvider>
        </ConfigProvider>
      </ReviewAdapterProvider>
    </StrictMode>
  );
  const view = render(content());
  return {
    ...view,
    adapter,
    review: () => review,
    begin: () => begin(),
    push: (value: DiffLoadPayload) => push(value),
    resume: (value: ResumeLoadPayload) => resume(value),
    changeAdapter: () => view.rerender(content({ ...adapter })),
  };
}
const comments = (f: ReturnType<typeof fixture>) => f.review().files.flatMap(file => file.comments);

describe('logical remote review and snapshot ownership', () => {
  it('keeps feedback, edits, viewed decisions and tombstones when the same PR has new SHA diff arguments', async () => {
    const f = fixture();
    await waitFor(() => expect(f.review().remote?.remoteHeadSha).toBe(firstHead));
    act(() => {
      f.resume({ comments: [thread('keep'), thread('delete')], viewedFiles: ['f.ts'] });
      f.review().editComment('keep', { body: 'Edited human feedback' });
      f.review().addReply('keep', 'Later human reply');
      f.review().deleteComment('delete');
      f.review().toggleViewed('f.ts');
    });
    const original = comments(f)[0];
    const session = f.review().sessionId;
    const snapshot = f.review().snapshotId;
    const oldOwner = f.review().isCurrentSession!;
    act(() => f.push(payload(nextHead)));
    expect(f.review().sessionId).toBe(session);
    expect(f.review().snapshotId).not.toBe(snapshot);
    expect(oldOwner()).toBe(false);
    expect(() => f.begin()).toThrow(/loading/);
    expect(comments(f)).toEqual([original]);
    act(() =>
      f.resume({
        comments: [thread('keep'), thread('delete'), thread('new')],
        viewedFiles: ['f.ts'],
      })
    );
    expect(comments(f)).toEqual([original, thread('new')]);
    expect(f.review().files[0].viewed).toBe(false);
  });

  it('retains exact verified anchors and converts changed or moved proposals to visible inert feedback', async () => {
    const applySuggestion = vi.fn();
    const f = fixture(payload(), { applySuggestion }, true);
    await waitFor(() => expect(f.review().remote).not.toBeNull());
    act(() => f.resume({ comments: [thread('verified', 1), thread('stale', 2)] }));
    expect(screen.getAllByTestId('suggestion-apply-button')).toHaveLength(2);
    const stale = comments(f)[1];
    act(() => f.push(payload(nextHead, [file('f.ts', ['alpha', 'different', 'beta'])])));
    const [verified, downgraded] = comments(f);
    expect(verified).toEqual(thread('verified', 1));
    expect(downgraded).toMatchObject({
      ...stale,
      lineRange: null,
      suggestion: null,
      orphaned: true,
      body: expect.stringContaining('Human stale'),
    });
    expect(downgraded.body).toContain('    beta');
    expect(downgraded.body).toContain('    fixed');
    expect(screen.getAllByTestId('suggestion-apply-button')).toHaveLength(1);
    expect(screen.getByTestId('comment-stale').textContent).toContain('Orphaned');
    expect(screen.getByTestId('comment-stale').textContent).toContain('Proposed code:');
    expect(f.review().importDiagnostics).toEqual([expect.stringContaining('stale')]);
    expect(applySuggestion).not.toHaveBeenCalled();
  });

  it.each(['missing', 'lazy', 'gap', 'wrong-original'] as const)(
    'refuses to transplant an unverified %s anchor',
    async kind => {
      const f = fixture();
      await waitFor(() => expect(f.review().remote).not.toBeNull());
      const original = thread('stale', 2);
      if (kind === 'wrong-original') original.suggestion!.originalCode = 'unrelated';
      act(() => f.resume({ comments: [original] }));
      const nextFile = file();
      if (kind === 'lazy') {
        nextFile.hunks = [];
        nextFile.contentLoaded = false;
      }
      if (kind === 'gap') nextFile.hunks[0].lines.pop();
      act(() => f.push(payload(nextHead, kind === 'missing' ? [] : [nextFile])));
      expect(comments(f)[0]).toMatchObject({
        id: 'stale',
        lineRange: null,
        suggestion: null,
        orphaned: true,
      });
      expect(comments(f)[0].replies).toEqual(original.replies);
      expect(f.review().reviewedPaths.has('f.ts')).toBe(kind !== 'missing');
    }
  );

  it('preserves same-PR feedback across a new owned clone, but invalidates pending content reads', async () => {
    const pending = deferred<{ hunks: []; totalLines: number }>();
    let signal!: AbortSignal;
    const f = fixture(payload(), {
      reads: {
        expandContext: (_request, owned) => {
          signal = owned;
          return pending.promise;
        },
      },
    });
    await waitFor(() => expect(f.review().remote).not.toBeNull());
    act(() => f.resume({ comments: [thread('human')] }));
    const read = f.review().expandFileContext('f.ts', 10);
    const next = payload(nextHead);
    next.source = {
      ...next.source,
      type: 'git',
      repository: '/new-clone',
      gitDiffArgs: `${base}...${nextHead}`,
    };
    act(() => f.push(next));
    expect(comments(f)).toEqual([thread('human')]);
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve({ hunks: [], totalLines: 99 }));
    await expect(read).resolves.toBeNull();
  });

  it('does not hydrate a newer pushed PR snapshot from an obsolete initial pull', async () => {
    const pull = deferred<DiffLoadPayload>();
    const loadResumedReview = vi.fn(async () => ({ comments: [thread('obsolete', 2)] }));
    const f = fixture(payload(), { loadDiff: () => pull.promise, loadResumedReview });
    act(() => f.push(payload(nextHead)));
    await act(async () => pull.resolve(payload()));
    expect(loadResumedReview).not.toHaveBeenCalled();
    expect(comments(f)).toEqual([]);
    act(() => f.resume({ comments: [thread('current')] }));
    expect(comments(f)).toEqual([thread('current')]);
  });

  it('drops an outstanding resume from the previous head and accepts feedback pushed for the new one', async () => {
    const old = deferred<ResumeLoadPayload>();
    const loadResumedReview = vi.fn(() => old.promise);
    const f = fixture(payload(), { loadResumedReview });
    await waitFor(() => expect(loadResumedReview).toHaveBeenCalled());
    act(() => {
      f.review().addComment('f.ts', null, 'Human draft', 'bug', null);
      f.push(payload(nextHead));
    });
    const requests = loadResumedReview.mock.calls.length;
    await act(async () => old.resolve({ comments: [thread('obsolete')] }));
    expect(loadResumedReview).toHaveBeenCalledTimes(requests);
    expect(comments(f).map(c => c.body)).toEqual(['Human draft']);
    act(() => f.resume({ comments: [thread('current')] }));
    expect(comments(f).map(c => c.body)).toEqual(['Human draft', 'Human current']);
  });

  it('refuses a manual retry of cached initial feedback after a newer head', async () => {
    const old = deferred<ResumeLoadPayload>();
    const loadResumedReview = vi.fn(() => old.promise);
    const f = fixture(payload(), { loadResumedReview });
    await waitFor(() => expect(loadResumedReview).toHaveBeenCalled());
    act(() => f.push(payload(nextHead)));
    const requests = loadResumedReview.mock.calls.length;
    await act(async () => old.resolve({ comments: [thread('obsolete', 2)] }));
    await act(async () => f.review().retryResume!());
    expect(loadResumedReview).toHaveBeenCalledTimes(requests);
    expect(comments(f)).toEqual([]);
    expect(f.review().resumeError).toContain('earlier remote snapshot');
    act(() => f.resume({ comments: [thread('current')] }));
    expect(f.review().resumeError).toBeNull();
    expect(comments(f)).toEqual([thread('current')]);
  });

  it.each(['url', 'forge', 'source-kind', 'adapter', 'local-arguments'] as const)(
    'keeps %s replacements distinct',
    async kind => {
      const initial = payload();
      if (kind === 'local-arguments') delete initial.remote;
      const f = fixture(initial);
      await waitFor(() => expect(f.review().files).toHaveLength(1));
      act(() => {
        f.review().addComment('f.ts', null, 'Old session', 'bug', null);
        f.review().toggleViewed('f.ts');
      });
      const previous = f.review().sessionId;
      const next = payload(nextHead);
      if (kind === 'url') next.remote!.remoteUrl = 'https://github.com/owner/repo/pull/8';
      if (kind === 'forge') next.remote!.remoteForge = 'gitlab';
      if (kind === 'source-kind') next.source = { type: 'directory', sourcePath: '/clone' };
      if (kind === 'local-arguments') delete next.remote;
      act(() => {
        if (kind === 'adapter') f.changeAdapter();
        else f.push(next);
      });
      await waitFor(() => expect(f.review().sessionId).not.toBe(previous));
      expect(comments(f)).toEqual([]);
      await waitFor(() => expect(f.review().files[0]?.viewed).toBe(false));
    }
  );
});
