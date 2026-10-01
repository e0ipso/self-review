import React, { createRef, forwardRef, type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import type {
  DiffFile,
  DiffLoadPayload,
  DiffSource,
  ResumeLoadPayload,
  ReviewComment,
  ReviewState,
} from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';
import type { ReviewAdapter } from '../adapter';
import { ConfigProvider } from './ConfigContext';
import { ReviewAdapterProvider } from './ReviewAdapterContext';
import { ReviewProvider, useReview, type ReviewContextValue } from './ReviewContext';
import { type ReviewHandle, useReviewBridge } from '../hooks/useReviewBridge';

installBrowserApiStubs();

function diffFile(path: string): DiffFile {
  return { oldPath: path, newPath: path, changeType: 'modified', isBinary: false, hunks: [] };
}

function dir(sourcePath: string): DiffSource {
  return { type: 'directory', sourcePath };
}

function comment(id: string, filePath: string, body = `comment ${id}`): ReviewComment {
  return { id, filePath, lineRange: null, body, category: 'bug', suggestion: null };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

/** An adapter whose later pushes the test drives by hand. */
function pushableAdapter(initial: DiffLoadPayload | Promise<DiffLoadPayload>) {
  const listeners = new Set<(p: DiffLoadPayload) => void>();
  const unsubscribe = vi.fn();
  const adapter: ReviewAdapter = {
    loadDiff: vi.fn(() => Promise.resolve(initial)),
    onDiffLoad: cb => {
      listeners.add(cb);
      return () => {
        unsubscribe();
        listeners.delete(cb);
      };
    },
  };
  const push = (payload: DiffLoadPayload) => listeners.forEach(cb => cb(payload));
  return { adapter, push, unsubscribe, listeners };
}

/** Exposes the live context and the exported review state to the test. */
const Probe = forwardRef<ReviewHandle, { live: { current: ReviewContextValue | null } }>(
  function Probe({ live }, ref) {
    live.current = useReview();
    useReviewBridge(ref);
    return null;
  }
);

function Tree({
  adapter,
  initialFiles,
  initialSource,
  initialComments,
  children,
}: {
  adapter: ReviewAdapter | null;
  initialFiles?: DiffFile[];
  initialSource?: DiffSource;
  initialComments?: ReviewComment[];
  children: ReactNode;
}) {
  const inner = (
    <ConfigProvider initialConfig={{}}>
      <ReviewProvider
        initialFiles={initialFiles}
        initialSource={initialSource}
        initialComments={initialComments}
      >
        {children}
      </ReviewProvider>
    </ConfigProvider>
  );
  return adapter ? <ReviewAdapterProvider adapter={adapter}>{inner}</ReviewAdapterProvider> : inner;
}

function mount(props: Omit<React.ComponentProps<typeof Tree>, 'children'>) {
  const live: { current: ReviewContextValue | null } = { current: null };
  const handle = createRef<ReviewHandle>();
  const view = render(
    <Tree {...props}>
      <Probe ref={handle} live={live} />
    </Tree>
  );
  const rerender = (next: Omit<React.ComponentProps<typeof Tree>, 'children'>) =>
    view.rerender(
      <Tree {...next}>
        <Probe ref={handle} live={live} />
      </Tree>
    );
  const exported = (): ReviewState => handle.current!.getReviewState();
  const ctx = () => live.current!;
  return { rerender, exported, ctx, view };
}

/** `path:viewed:commentBodies` for every exported file, in order. */
function summary(state: ReviewState): string[] {
  return state.files.map(f => `${f.path}:${f.viewed}:${f.comments.map(c => c.body).join(',')}`);
}

describe('ReviewProvider adapter replacement', () => {
  it('loads the replacement adapter and drops every trace of the previous session', async () => {
    const a = pushableAdapter({ files: [diffFile('a.txt')], source: dir('/a') });
    const b = pushableAdapter({ files: [diffFile('b.txt')], source: dir('/b') });

    const { rerender, exported, ctx } = mount({ adapter: a.adapter });
    await waitFor(() => expect(summary(exported())).toEqual(['a.txt:false:']));

    act(() => {
      ctx().addComment('a.txt', null, 'old', 'bug', null);
      ctx().toggleViewed('a.txt');
    });
    expect(summary(exported())).toEqual(['a.txt:true:old']);

    rerender({ adapter: b.adapter });

    await waitFor(() => expect(summary(exported())).toEqual(['b.txt:false:']));
    expect(b.adapter.loadDiff).toHaveBeenCalledTimes(1);
    expect(exported().source).toEqual(dir('/b'));
    expect(ctx().diffFiles.map(f => f.newPath)).toEqual(['b.txt']);
    // The previous adapter's subscription is released, and a late push from
    // it cannot reach the new session.
    expect(a.unsubscribe).toHaveBeenCalled();
    expect(a.listeners.size).toBe(0);
  });

  it('ignores a load from the previous adapter that settles after the replacement', async () => {
    const slow = deferred<DiffLoadPayload>();
    const a = pushableAdapter(slow.promise);
    const b = pushableAdapter({ files: [diffFile('b.txt')], source: dir('/b') });

    const { rerender, exported } = mount({ adapter: a.adapter });
    rerender({ adapter: b.adapter });
    await waitFor(() => expect(summary(exported())).toEqual(['b.txt:false:']));

    await act(async () => {
      slow.resolve({ files: [diffFile('a.txt')], source: dir('/a') });
    });

    expect(summary(exported())).toEqual(['b.txt:false:']);
    expect(exported().source).toEqual(dir('/b'));
  });
});

describe('ReviewProvider pushed session replacement', () => {
  async function loaded() {
    const a = pushableAdapter({ files: [diffFile('same.txt')], source: dir('/a') });
    const mounted = mount({ adapter: a.adapter });
    await waitFor(() => expect(summary(mounted.exported())).toEqual(['same.txt:false:']));
    act(() => {
      mounted.ctx().addComment('same.txt', null, 'old', 'bug', null);
      mounted.ctx().toggleViewed('same.txt');
    });
    return { ...a, ...mounted };
  }

  it('starts a same-named file of a different session with no comments or viewed flag', async () => {
    const { push, exported } = await loaded();

    act(() => push({ files: [diffFile('same.txt')], source: dir('/b') }));

    expect(summary(exported())).toEqual(['same.txt:false:']);
    expect(exported().source).toEqual(dir('/b'));
  });

  it('drops the previous session files when the new session names different ones', async () => {
    const { push, exported } = await loaded();

    act(() => push({ files: [diffFile('other.txt')], source: dir('/b') }));

    expect(summary(exported())).toEqual(['other.txt:false:']);
  });

  it('exports an empty review for an empty replacement session', async () => {
    const { push, exported, ctx } = await loaded();

    act(() => push({ files: [], source: dir('/empty') }));

    expect(exported().files).toEqual([]);
    expect(exported().source).toEqual(dir('/empty'));
    expect(ctx().diffFiles).toEqual([]);
  });

  it('treats a different remote URL over the same clone as a different session', async () => {
    const git: DiffSource = { type: 'git', gitDiffArgs: 'x...y', repository: '/clone' };
    const remote = (remoteUrl: string) => ({
      remoteUrl,
      remoteForge: 'github' as const,
      remoteBaseSha: 'x',
      remoteHeadSha: 'y',
      threadSyncAvailable: false,
      temporaryClone: false,
    });
    const a = pushableAdapter({ files: [diffFile('f.ts')], source: git, remote: remote('u1') });
    const { exported, ctx } = mount({ adapter: a.adapter });
    await waitFor(() => expect(exported().files).toHaveLength(1));
    act(() => ctx().addComment('f.ts', null, 'old', 'bug', null));

    act(() => a.push({ files: [diffFile('f.ts')], source: git, remote: remote('u2') }));

    expect(summary(exported())).toEqual(['f.ts:false:']);
    expect(ctx().remote?.remoteUrl).toBe('u2');
  });

  it('keeps comments and viewed flags through a same-session update', async () => {
    const { push, exported, ctx } = await loaded();

    act(() => push({ files: [diffFile('same.txt'), diffFile('new.txt')], source: dir('/a') }));

    expect(summary(exported())).toEqual(['same.txt:true:old', 'new.txt:false:']);
    expect(ctx().diffFiles.map(f => f.newPath)).toEqual(['same.txt', 'new.txt']);
  });

  it('keeps a commented file a same-session update no longer lists', async () => {
    const { push, exported } = await loaded();

    act(() => push({ files: [diffFile('new.txt')], source: dir('/a') }));

    // Human feedback is never dropped silently: the thread survives on a
    // synthetic entry, the way resumed comments on vanished paths do.
    expect(summary(exported())).toEqual(['new.txt:false:', 'same.txt:true:old']);
  });

  it('never applies a resumed review that belonged to a replaced session', async () => {
    const resume = deferred<ResumeLoadPayload>();
    const a = pushableAdapter({ files: [diffFile('a.txt')], source: dir('/a') });
    a.adapter.loadResumedReview = () => resume.promise;
    const { exported } = mount({ adapter: a.adapter });
    await waitFor(() => expect(exported().files).toHaveLength(1));

    act(() => a.push({ files: [diffFile('a.txt')], source: dir('/b') }));
    await act(async () => {
      resume.resolve({ comments: [comment('r1', 'a.txt', 'stale')], viewedFiles: ['a.txt'] });
    });

    expect(summary(exported())).toEqual(['a.txt:false:']);
  });

  it('still resumes when the host delivers the initial payload as a push first', async () => {
    // The Electron preload hands the one diff:load reply to every listener,
    // so the subscription can see the initial payload before loadDiff's
    // continuation runs. That is one session, not a replacement.
    const payload: DiffLoadPayload = { files: [diffFile('a.txt')], source: dir('/a') };
    const gate = deferred<DiffLoadPayload>();
    const a = pushableAdapter(gate.promise);
    a.adapter.loadResumedReview = async () => ({
      comments: [comment('r1', 'a.txt', 'resumed')],
      viewedFiles: ['a.txt'],
    });
    const { exported } = mount({ adapter: a.adapter });

    await act(async () => {
      a.push(payload);
      gate.resolve(payload);
    });

    await waitFor(() => expect(summary(exported())).toEqual(['a.txt:true:resumed']));
  });
});

describe('ReviewProvider welcome placeholder', () => {
  it('hands a resume requested on the welcome screen to the session that replaces it', async () => {
    // Electron: the resume request made for the welcome payload stays
    // pending until main opens a remote PR/MR, then answers it with the
    // fetched forge threads right after pushing the new diff.
    const resume = deferred<ResumeLoadPayload>();
    const a = pushableAdapter({ files: [], source: { type: 'welcome' } });
    a.adapter.loadResumedReview = () => resume.promise;
    const { exported } = mount({ adapter: a.adapter });
    await waitFor(() => expect(exported().source).toEqual({ type: 'welcome' }));

    act(() => a.push({ files: [diffFile('pr.ts')], source: dir('/clone') }));
    await act(async () => {
      resume.resolve({ comments: [comment('t1', 'pr.ts', 'forge thread')] });
    });

    expect(summary(exported())).toEqual(['pr.ts:false:forge thread']);
  });
});

describe('ReviewProvider initial load ordering', () => {
  it('ignores an initial load that settles after a push started a different session', async () => {
    const gate = deferred<DiffLoadPayload>();
    const a = pushableAdapter(gate.promise);
    const resumed = vi.fn(async () => ({ comments: [comment('r1', 'old.txt')] }));
    a.adapter.loadResumedReview = resumed;
    const { exported } = mount({ adapter: a.adapter });

    act(() => a.push({ files: [diffFile('pushed.txt')], source: dir('/pushed') }));
    await act(async () => {
      gate.resolve({ files: [diffFile('old.txt')], source: dir('/old') });
    });

    expect(summary(exported())).toEqual(['pushed.txt:false:']);
    expect(exported().source).toEqual(dir('/pushed'));
    expect(resumed).not.toHaveBeenCalled();
  });
});

describe('ReviewProvider initialComments hydration', () => {
  it('holds comments supplied before the files arrive and applies them once they do', async () => {
    const gate = deferred<DiffLoadPayload>();
    const a = pushableAdapter(gate.promise);
    const { exported } = mount({ adapter: a.adapter, initialComments: [comment('c1', 'a.txt')] });

    await act(async () => {
      gate.resolve({ files: [diffFile('a.txt')], source: dir('/a') });
    });

    await waitFor(() => expect(summary(exported())).toEqual(['a.txt:false:comment c1']));
  });

  it('never re-applies a new array identity over later edits', async () => {
    const a = pushableAdapter({ files: [diffFile('a.txt')], source: dir('/a') });
    const { exported, ctx, rerender } = mount({
      adapter: a.adapter,
      initialComments: [comment('c1', 'a.txt')],
    });
    await waitFor(() => expect(summary(exported())).toEqual(['a.txt:false:comment c1']));

    act(() => ctx().editComment('c1', { body: 'edited' }));
    rerender({ adapter: a.adapter, initialComments: [comment('c1', 'a.txt')] });
    expect(summary(exported())).toEqual(['a.txt:false:edited']);

    act(() => ctx().deleteComment('c1'));
    rerender({ adapter: a.adapter, initialComments: [comment('c1', 'a.txt')] });
    expect(summary(exported())).toEqual(['a.txt:false:']);
  });

  it('applies exactly once with static files', () => {
    const { exported, ctx, rerender } = mount({
      adapter: null,
      initialFiles: [diffFile('a.txt')],
      initialSource: dir('/a'),
      initialComments: [comment('c1', 'a.txt')],
    });
    expect(summary(exported())).toEqual(['a.txt:false:comment c1']);

    act(() => ctx().deleteComment('c1'));
    rerender({
      adapter: null,
      initialFiles: [diffFile('a.txt')],
      initialSource: dir('/a'),
      initialComments: [comment('c1', 'a.txt'), comment('c2', 'a.txt')],
    });
    expect(summary(exported())).toEqual(['a.txt:false:']);
  });

  it('keeps comments on a path the diff does not contain', async () => {
    const a = pushableAdapter({ files: [diffFile('a.txt')], source: dir('/a') });
    const { exported } = mount({
      adapter: a.adapter,
      initialComments: [comment('c1', 'gone.txt'), comment('c2', '')],
    });

    await waitFor(() =>
      expect(summary(exported())).toEqual([
        'a.txt:false:',
        'gone.txt:false:comment c1',
        ':false:comment c2',
      ])
    );
  });

  it('hydrates a session whose diff is empty', async () => {
    const a = pushableAdapter({ files: [], source: dir('/a') });
    const { exported } = mount({ adapter: a.adapter, initialComments: [comment('c1', '')] });

    await waitFor(() => expect(summary(exported())).toEqual([':false:comment c1']));
  });
});

describe('ReviewProvider static files', () => {
  it('reconciles new initialFiles for the same source without losing edits', () => {
    const { exported, ctx, rerender } = mount({
      adapter: null,
      initialFiles: [diffFile('a.txt')],
      initialSource: dir('/a'),
    });
    act(() => ctx().addComment('a.txt', null, 'kept', 'bug', null));

    rerender({
      adapter: null,
      initialFiles: [diffFile('a.txt'), diffFile('b.txt')],
      initialSource: dir('/a'),
    });

    expect(summary(exported())).toEqual(['a.txt:false:kept', 'b.txt:false:']);
  });

  it('starts a new session when initialSource names a different source', () => {
    const { exported, ctx, rerender } = mount({
      adapter: null,
      initialFiles: [diffFile('a.txt')],
      initialSource: dir('/a'),
    });
    act(() => ctx().addComment('a.txt', null, 'old', 'bug', null));

    rerender({ adapter: null, initialFiles: [diffFile('a.txt')], initialSource: dir('/b') });

    expect(summary(exported())).toEqual(['a.txt:false:']);
    expect(exported().source).toEqual(dir('/b'));
  });
});
