import React, { createRef, forwardRef, useLayoutEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiffLoadPayload, ResumeLoadPayload, ReviewComment } from '@self-review/types';
import type { ReviewAdapter } from '../adapter';
import { ConfigProvider } from './ConfigContext';
import { ReviewAdapterProvider } from './ReviewAdapterContext';
import {
  ReviewProvider,
  useReview,
  useReviewSaveTransaction,
  type ReviewContextValue,
  type ReviewSaveTransaction,
} from './ReviewContext';
import { useReviewBridge, type ReviewHandle } from '../hooks/useReviewBridge';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();

const payload: DiffLoadPayload = {
  files: [{ oldPath: 'a', newPath: 'a', changeType: 'modified', isBinary: false, hunks: [] }],
  source: { type: 'directory', sourcePath: '/a' },
};
const comment = (id: string, body = id): ReviewComment => ({
  id,
  body,
  filePath: 'a',
  category: 'note',
  lineRange: null,
  suggestion: null,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function mount({
  adapter,
  staticFiles = false,
  comments,
  strict = false,
  onLayout,
}: {
  adapter?: ReviewAdapter;
  staticFiles?: boolean;
  comments?: ReviewComment[];
  strict?: boolean;
  onLayout?: (save: ReviewSaveTransaction) => void;
} = {}) {
  let save!: ReviewSaveTransaction;
  let review!: ReviewContextValue;
  const handle = createRef<ReviewHandle>();
  const Probe = forwardRef<ReviewHandle>(function Probe(_props, ref) {
    save = useReviewSaveTransaction();
    review = useReview();
    useReviewBridge(ref);
    useLayoutEffect(() => {
      onLayout?.(save);
    }, []);
    return null;
  });
  const inner = (
    <ConfigProvider>
      <ReviewProvider
        initialFiles={staticFiles ? payload.files : undefined}
        initialSource={staticFiles ? payload.source : undefined}
        initialComments={comments}
      >
        <Probe ref={handle} />
      </ReviewProvider>
    </ConfigProvider>
  );
  const tree = adapter ? (
    <ReviewAdapterProvider adapter={adapter}>{inner}</ReviewAdapterProvider>
  ) : (
    inner
  );
  const view = render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
  return { ...view, begin: () => save.begin(), review: () => review, handle };
}
function pushAdapter(loadResumedReview?: ReviewAdapter['loadResumedReview']) {
  let diff!: (value: DiffLoadPayload) => void;
  let resume!: (value: ResumeLoadPayload) => void;
  const adapter: ReviewAdapter = {
    loadDiff: async () => payload,
    loadResumedReview,
    onDiffLoad: callback => {
      diff = callback;
      return () => {};
    },
    onResumeLoad: callback => {
      resume = callback;
      return () => {};
    },
  };
  return {
    adapter,
    push: (value: DiffLoadPayload) => diff(value),
    resume: (value: ResumeLoadPayload) => resume(value),
  };
}
const bodies = (owner: ReturnType<ReviewSaveTransaction['begin']>) =>
  owner.state.files.flatMap(f => f.comments.map(c => c.body));

describe('atomic save readiness', () => {
  it('keeps the legacy snapshot readable while loading, pending resume and locked publication', async () => {
    const loaded = deferred<DiffLoadPayload>();
    const resumed = deferred<ResumeLoadPayload>();
    const f = mount({
      adapter: { loadDiff: () => loaded.promise, loadResumedReview: () => resumed.promise },
    });
    const legacy: ReviewHandle = { getReviewState: () => f.handle.current!.getReviewState() };
    expect(legacy.beginSave).toBeUndefined();
    expect(legacy.getReviewState().source.type).toBe('loading');
    expect(legacy.getReviewState().files).toEqual([]);
    await act(async () => loaded.resolve(payload));
    const pending = legacy.getReviewState();
    expect(pending.source).toBe(payload.source);
    expect(pending.files).toBe(f.review().files);
    expect(() => f.begin()).toThrow(/loading/);
    // Reading never reserves mutations, even before saved feedback is acknowledged.
    act(() => f.review().addComment('a', null, 'edited while pending', 'note', null));
    await act(async () => resumed.resolve({ comments: [] }));
    const ready = legacy.getReviewState();
    const capture = f.begin();
    expect(capture.state.files).toBe(ready.files);
    expect(legacy.getReviewState().files).toBe(ready.files);
    expect(pending.files[0].comments).toEqual([]);
    capture.unlock();
  });

  it('refuses capture after the diff arrives but before resumed feedback, without dropping either feedback or edits', async () => {
    const resumed = deferred<ResumeLoadPayload>();
    const f = mount({
      adapter: { loadDiff: async () => payload, loadResumedReview: () => resumed.promise },
    });
    await waitFor(() => expect(f.review().diffSource).toEqual(payload.source));
    // This is the original loss interval: locking here used to discard the later resume action.
    expect(() => f.begin()).toThrow(/loading/);
    act(() => f.review().addComment('a', null, 'reviewer edit', 'note', null));
    await act(async () => resumed.resolve({ comments: [comment('saved')], viewedFiles: ['a'] }));
    const owner = f.begin();
    expect(bodies(owner)).toEqual(['reviewer edit', 'saved']);
    expect(owner.state.files[0].viewed).toBe(true);
    act(() => f.review().deleteComment('saved'));
    expect(f.handle.current!.getReviewState().files[0].comments).toHaveLength(2);
  });

  it('preserves comment deletions, edits and explicit unviewing made while resume is pending', async () => {
    const resumed = deferred<ResumeLoadPayload>();
    const f = mount({
      staticFiles: true,
      comments: [comment('edit'), comment('remove')],
      adapter: {
        loadDiff: vi.fn(),
        loadResumedReview: () => resumed.promise,
      },
    });
    act(() => {
      f.review().editComment('edit', { body: 'human edit' });
      f.review().deleteComment('remove');
      f.review().toggleViewed('a');
      f.review().toggleViewed('a');
    });
    await act(async () =>
      resumed.resolve({
        comments: [comment('edit'), comment('remove'), comment('new')],
        viewedFiles: ['a'],
      })
    );
    const owner = f.begin();
    expect(bodies(owner)).toEqual(['human edit', 'new']);
    expect(owner.state.files[0].viewed).toBe(false);
  });

  it('never loses resumed feedback when saving is attempted in the pending-resume interval', async () => {
    const resumed = deferred<ResumeLoadPayload>();
    const f = mount({
      adapter: { loadDiff: async () => payload, loadResumedReview: () => resumed.promise },
    });
    await waitFor(() => expect(f.review().diffSource).toEqual(payload.source));
    let premature: ReturnType<ReviewSaveTransaction['begin']> | undefined;
    try {
      premature = f.begin();
    } catch {
      /* A pending resume must refuse capture. */
    }
    await act(async () => resumed.resolve({ comments: [comment('saved feedback')] }));
    // On the original source the premature capture locked out the resume action entirely.
    expect(f.handle.current!.getReviewState().files[0].comments.map(c => c.body)).toEqual([
      'saved feedback',
    ]);
    expect(premature).toBeUndefined();
    expect(bodies(f.begin())).toEqual(['saved feedback']);
  });

  it.each([null, { comments: [] }, { comments: [comment('restored')] }])(
    'waits for a static session resume acknowledgement: %j',
    async ack => {
      const resumed = deferred<ResumeLoadPayload | null>();
      const layout = vi.fn((save: ReviewSaveTransaction) =>
        expect(() => save.begin()).toThrow(/loading/)
      );
      const f = mount({
        staticFiles: true,
        onLayout: layout,
        comments: [comment('seed')],
        adapter: {
          loadDiff: vi.fn(),
          // Older hosts may acknowledge no document with null; the public loader signature stays intact.
          loadResumedReview: () => resumed.promise as Promise<ResumeLoadPayload>,
        },
      });
      expect(layout).toHaveBeenCalledOnce();
      expect(() => f.handle.current!.beginSave!()).toThrow(/loading/);
      await act(async () => resumed.resolve(ack));
      expect(bodies(f.handle.current!.beginSave!())).toEqual(
        ack?.comments.length ? ['seed', 'restored'] : ['seed']
      );
    }
  );

  it('seeds static initial comments before a child can capture, without a resume capability', () => {
    let captured: string[] = [];
    mount({
      staticFiles: true,
      comments: [comment('seed')],
      onLayout: save => {
        captured = bodies(save.begin());
      },
    });
    expect(captured).toEqual(['seed']);
  });

  it.each([false, true])(
    'does not wait for an optional later-push subscription on an initial session, static=%s',
    async staticFiles => {
      const host = pushAdapter();
      const f = mount({ staticFiles, adapter: host.adapter });
      if (!staticFiles) await waitFor(() => expect(f.review().diffSource).toEqual(payload.source));
      expect(bodies(f.begin())).toEqual([]);
    }
  );

  it('keeps a failed resume unsaveable throughout manual retry, then captures the recovered comments', async () => {
    const retry = deferred<ResumeLoadPayload>();
    const loadResumedReview = vi
      .fn()
      .mockRejectedValueOnce(new Error('feedback offline'))
      .mockImplementation(() => retry.promise);
    const f = mount({ adapter: { loadDiff: async () => payload, loadResumedReview } });
    expect((await screen.findByRole('alert')).textContent).toContain('feedback offline');
    expect(() => f.begin()).toThrow(/loading/);
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading saved feedback' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(() => f.begin()).toThrow(/loading/);
    await act(async () => retry.resolve({ comments: [comment('recovered')] }));
    expect(bodies(f.begin())).toEqual(['recovered']);
    expect(loadResumedReview).toHaveBeenCalledTimes(2);
  });

  it.each(['empty error', 'missing acknowledgement'])(
    'does not fabricate readiness after %s',
    async kind => {
      const loadResumedReview =
        kind === 'empty error'
          ? vi.fn().mockRejectedValue(new Error(''))
          : vi.fn().mockResolvedValue(undefined);
      const f = mount({ adapter: { loadDiff: async () => payload, loadResumedReview } });
      await screen.findByRole('button', { name: 'Retry loading saved feedback' });
      expect(() => f.begin()).toThrow(/loading/);
      expect(loadResumedReview).toHaveBeenCalledOnce();
    }
  );

  it('makes pushed replacements pending synchronously and only lets their current resume request settle readiness', async () => {
    const first = deferred<ResumeLoadPayload>();
    const load = vi.fn(() => first.promise);
    const host = pushAdapter(load);
    const f = mount({ adapter: host.adapter });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    act(() => {
      host.push({ ...payload, source: { type: 'directory', sourcePath: '/b' } });
      expect(() => f.begin()).toThrow(/loading/);
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve({ comments: [comment('stale')] }));
    expect(() => f.begin()).toThrow(/loading/);
    act(() => host.resume({ comments: [comment('current')] }));
    expect(bodies(f.begin())).toEqual(['current']);
  });

  it('accepts a pushed acknowledgement and ignores its superseded pull, including an empty acknowledgement', async () => {
    const old = deferred<ResumeLoadPayload>();
    const host = pushAdapter(() => old.promise);
    const f = mount({ adapter: host.adapter });
    await waitFor(() => expect(f.review().diffSource).toEqual(payload.source));
    expect(() => f.begin()).toThrow(/loading/);
    act(() => host.resume({ comments: [] }));
    act(() => f.review().addComment('a', null, 'human', 'note', null));
    await act(async () => old.resolve({ comments: [comment('stale')] }));
    expect(bodies(f.begin())).toEqual(['human']);
  });

  it('does not rehydrate deleted or edited comments on a same-identity update or duplicate delivery', async () => {
    const load = vi.fn(async () => ({ comments: [comment('edit'), comment('delete')] }));
    const host = pushAdapter(load);
    const f = mount({ adapter: host.adapter });
    await waitFor(() => expect(f.review().files[0]?.comments).toHaveLength(2));
    act(() => {
      f.review().editComment('edit', { body: 'human edit' });
      f.review().deleteComment('delete');
      host.push(payload);
      host.push(payload);
    });
    expect(bodies(f.begin())).toEqual(['human edit']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('drops a prior snapshot response while the same session has a newer pending snapshot', async () => {
    const old = deferred<ResumeLoadPayload>();
    const fresh = deferred<ResumeLoadPayload>();
    const load = vi
      .fn()
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => fresh.promise);
    const host = pushAdapter(load);
    const f = mount({ adapter: host.adapter });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    act(() => host.push({ ...payload, diagnostics: ['new snapshot'] }));
    await act(async () => old.reject(new Error('stale failure')));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(() => f.begin()).toThrow(/loading/);
    await act(async () => fresh.resolve({ comments: [] }));
    expect(bodies(f.begin())).toEqual([]);
  });

  it('gives each save exclusive ownership and never unlocks a newer save from an old reply', async () => {
    const host = pushAdapter();
    delete host.adapter.onResumeLoad;
    const f = mount({ adapter: host.adapter });
    await waitFor(() => expect(f.review().diffSource).toEqual(payload.source));
    const old = f.begin();
    expect(() => f.begin()).toThrow(/already owns/);
    act(() => host.push(payload));
    expect(old.current()).toBe(false);
    act(() => f.review().toggleViewed('a'));
    const next = f.begin();
    old.unlock();
    act(() => f.review().toggleViewed('a'));
    expect(f.handle.current!.getReviewState().files[0].viewed).toBe(true);
    expect(next.state.files[0].viewed).toBe(true);
    next.unlock();
    const third = f.begin();
    next.unlock();
    expect(() => f.begin()).toThrow(/already owns/);
    expect(third.current()).toBe(true);
    f.unmount();
    expect(third.current()).toBe(false);
  });

  it('restarts discarded StrictMode requests and waits for the active request', async () => {
    const old = deferred<ResumeLoadPayload>();
    const fresh = deferred<ResumeLoadPayload>();
    const load = vi
      .fn()
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => fresh.promise);
    const f = mount({
      staticFiles: true,
      strict: true,
      adapter: { loadDiff: vi.fn(), loadResumedReview: load },
    });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => old.resolve({ comments: [comment('stale')] }));
    expect(() => f.begin()).toThrow(/loading/);
    await act(async () => fresh.resolve({ comments: [comment('current')] }));
    expect(bodies(f.begin())).toEqual(['current']);
  });
});
