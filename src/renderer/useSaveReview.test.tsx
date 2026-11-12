import React, { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ConfigProvider } from '../../packages/react/src/context/ConfigContext';
import { ReviewProvider, useReview } from '../../packages/react/src/context/ReviewContext';
import { ReviewAdapterProvider } from '../../packages/react/src/context/ReviewAdapterContext';
import { installBrowserApiStubs } from '../../packages/react/src/test-helpers';
import type { ReviewSaveResult, ReviewState, DiffLoadPayload } from '../shared/types';
import { SaveReviewBoundary, useSaveReview } from './useSaveReview';

installBrowserApiStubs();
const payload: DiffLoadPayload = {
  files: [{ oldPath: 'a.ts', newPath: 'a.ts', changeType: 'modified', isBinary: false, hunks: [] }],
  source: { type: 'directory', sourcePath: '/review' },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(strict = false) {
  let failed: (() => void) | undefined;
  const publication = deferred<ReviewSaveResult>();
  const saveReview = vi.fn((_state: ReviewState) => publication.promise);
  const acknowledgeReviewSave = vi.fn();
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    onSaveFailed: vi.fn((callback: () => void) => {
      failed = callback;
      return vi.fn();
    }),
    saveReview,
    acknowledgeReviewSave,
    getSaveResult: vi.fn(async () => ({ status: 'saved', receipt: 'disk-receipt' }) as const),
  };
  let directSave!: () => void;
  let directEdit!: () => void;
  let directComment!: (body: string) => void;
  const shortcut = vi.fn();
  function Controls() {
    const review = useReview();
    const save = useSaveReview(api);
    directSave = save;
    directEdit = () => review.toggleViewed('a.ts');
    directComment = body => review.addComment('a.ts', null, body, 'note', null);
    useEffect(() => {
      document.addEventListener('keydown', shortcut);
      return () => document.removeEventListener('keydown', shortcut);
    }, []);
    return (
      <>
        <button onClick={save}>Finish</button>
        <button onClick={() => review.toggleViewed('a.ts')}>Toggle viewed</button>
        <span>Comments: {review.files[0]?.comments.length ?? 0}</span>
        <output>{review.files[0]?.viewed ? 'Viewed' : 'Unviewed'}</output>
      </>
    );
  }
  const tree = (boundaryAPI: Parameters<typeof useSaveReview>[0] = api) => (
    <ConfigProvider initialConfig={{}}>
      <ReviewProvider initialFiles={payload.files} initialSource={payload.source}>
        <SaveReviewBoundary api={boundaryAPI}>
          <Controls />
        </SaveReviewBoundary>
      </ReviewProvider>
    </ConfigProvider>
  );
  const view = render(tree(), { wrapper: strict ? React.StrictMode : undefined });
  return {
    ...view,
    replaceAPI: (next: Parameters<typeof useSaveReview>[0]) => view.rerender(tree(next)),
    fail: () => failed?.(),
    api,
    publication,
    shortcut,
    save: () => directSave(),
    edit: () => directEdit(),
    comment: (body: string) => directComment(body),
  };
}

it('freezes mutations and shortcuts immediately, deduplicates save, then restores editing after a known failure', async () => {
  const f = fixture();
  fireEvent.click(screen.getByText('Toggle viewed'));
  act(() => f.comment('Retain this comment'));
  fireEvent.click(screen.getByText('Finish'));
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(true);
  act(() => {
    f.save();
    f.edit();
    f.comment('Blocked during publication');
  });
  fireEvent.keyDown(document, { key: 'f' });
  fireEvent.click(screen.getByText('Toggle viewed'));
  expect(f.shortcut).not.toHaveBeenCalled();
  expect(screen.getByText('Viewed')).toBeTruthy();
  expect(f.api.saveReview).toHaveBeenCalledTimes(1);
  expect(f.api.saveReview.mock.calls[0][0].files[0].viewed).toBe(true);
  expect(f.api.saveReview.mock.calls[0][0].files[0].comments.map(comment => comment.body)).toEqual([
    'Retain this comment',
  ]);
  await act(async () =>
    f.publication.resolve({ status: 'failed', message: 'Disk full', detail: 'Free space' })
  );
  expect(screen.getByRole('alert').textContent).toContain('Disk full');
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
  fireEvent.click(screen.getByText('Toggle viewed'));
  expect(screen.getByText('Unviewed')).toBeTruthy();
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  act(() => f.comment('After recovery'));
  expect(screen.getByText('Comments: 2')).toBeTruthy();
});

it('receives publication before allowing shutdown and never retries a committed save with a lost reply', async () => {
  const f = fixture();
  fireEvent.click(screen.getByText('Finish'));
  // A faithful write boundary: the disk write committed; its reply disconnected.
  await act(async () =>
    f.publication.reject(Object.assign(new Error('lost reply'), { uncertain: true }))
  );
  expect(screen.getByText(/The save outcome is unknown/)).toBeTruthy();
  act(() => f.save());
  expect(f.api.saveReview).toHaveBeenCalledTimes(1);
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Check publication status'));
  await waitFor(() =>
    expect(f.api.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('disk-receipt')
  );
  expect(f.api.saveReview).toHaveBeenCalledTimes(1);
});

it('acknowledges a received receipt without unlocking the saved snapshot', async () => {
  const f = fixture();
  fireEvent.click(screen.getByText('Finish'));
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  await act(async () => f.publication.resolve({ status: 'saved', receipt: 'published' }));
  expect(f.api.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('published');
  act(() => f.edit());
  expect(screen.getByText('Unviewed')).toBeTruthy();
});

it.each(['session', 'snapshot'])(
  'drops an old publication reply when the review %s is replaced',
  async mode => {
    const publication = deferred<ReviewSaveResult>();
    const api = {
      submitReview: vi.fn(),
      saveAndQuit: vi.fn(),
      saveReview: () => publication.promise,
      acknowledgeReviewSave: vi.fn(),
    };
    let push!: (value: DiffLoadPayload) => void;
    const adapter = {
      loadDiff: async () => payload,
      onDiffLoad: (callback: typeof push) => {
        push = callback;
        return () => {};
      },
    };
    function Finish() {
      const save = useSaveReview(api);
      return <button onClick={save}>Finish</button>;
    }
    render(
      <ReviewAdapterProvider adapter={adapter}>
        <ConfigProvider initialConfig={{}}>
          <ReviewProvider>
            <SaveReviewBoundary api={api}>
              <Finish />
            </SaveReviewBoundary>
          </ReviewProvider>
        </ConfigProvider>
      </ReviewAdapterProvider>
    );
    await waitFor(() => expect(push).toBeTypeOf('function'));
    fireEvent.click(screen.getByText('Finish'));
    await act(async () =>
      push(
        mode === 'session'
          ? { ...payload, source: { type: 'directory', sourcePath: '/new' } }
          : { ...payload, files: [{ ...payload.files[0], hunks: [] }] }
      )
    );
    await act(async () => publication.resolve({ status: 'saved', receipt: 'stale' }));
    expect(api.acknowledgeReviewSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
  }
);

it('hands one acknowledged snapshot to the host and freezes direct mutations before it answers', async () => {
  const publication = deferred<ReviewSaveResult>();
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    saveReview: vi.fn(() => publication.promise),
    acknowledgeReviewSave: vi.fn(),
  };
  let edit!: () => void;
  function Controls() {
    const review = useReview();
    const save = useSaveReview(api);
    edit = () => review.toggleViewed('a.ts');
    return (
      <>
        <button onClick={save}>Finish</button>
        <span>{review.files[0]?.viewed ? 'Viewed' : 'Unviewed'}</span>
      </>
    );
  }
  render(
    <ConfigProvider initialConfig={{}}>
      <ReviewProvider initialFiles={payload.files} initialSource={payload.source}>
        <Controls />
      </ReviewProvider>
    </ConfigProvider>
  );
  fireEvent.click(screen.getByText('Finish'));
  act(() => edit());
  expect(screen.getByText('Unviewed')).toBeTruthy();
  expect(api.saveReview).toHaveBeenCalledTimes(1);
  expect(api.submitReview).not.toHaveBeenCalled();
  await act(async () => publication.resolve({ status: 'saved', receipt: 'done' }));
});

it('keeps a legacy save visibly unacknowledged and restores editing on an explicit failure push', async () => {
  let failed!: () => void;
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    onSaveFailed: (callback: () => void) => {
      failed = callback;
      return () => {};
    },
  };
  function Finish() {
    const save = useSaveReview(api);
    return <button onClick={save}>Legacy finish</button>;
  }
  render(
    <ConfigProvider initialConfig={{}}>
      <ReviewProvider initialFiles={payload.files} initialSource={payload.source}>
        <SaveReviewBoundary api={api}>
          <Finish />
        </SaveReviewBoundary>
      </ReviewProvider>
    </ConfigProvider>
  );
  fireEvent.click(screen.getByText('Legacy finish'));
  expect(api.submitReview).toHaveBeenCalledTimes(1);
  expect(api.saveAndQuit).toHaveBeenCalledTimes(1);
  await screen.findByText(/The save outcome is unknown/);
  act(() => failed());
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
});

it('refuses publication while the current diff is still a loading placeholder', async () => {
  const resume = deferred<import('../shared/types').ResumeLoadPayload>();
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    saveReview: vi.fn(),
    acknowledgeReviewSave: vi.fn(),
  };
  const adapter = { loadDiff: async () => payload, loadResumedReview: () => resume.promise };
  function Finish() {
    const save = useSaveReview(api);
    return <button onClick={save}>Finish loading</button>;
  }
  render(
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider initialConfig={{}}>
        <ReviewProvider>
          <SaveReviewBoundary api={api}>
            <Finish />
          </SaveReviewBoundary>
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
  fireEvent.click(screen.getByText('Finish loading'));
  expect(api.saveReview).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('still loading');
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
  await act(async () => resume.resolve({ comments: [], viewedFiles: [] }));
});

it('refuses desktop save after diff arrival until pending resumed feedback is hydrated', async () => {
  const resumed = deferred<import('../shared/types').ResumeLoadPayload>();
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    saveReview: vi.fn(async () => ({ status: 'saved', receipt: 'complete' }) as const),
    acknowledgeReviewSave: vi.fn(),
  };
  const adapter = { loadDiff: async () => payload, loadResumedReview: () => resumed.promise };
  function Controls() {
    const review = useReview();
    const save = useSaveReview(api);
    return (
      <>
        <button onClick={save}>Finish hydrated</button>
        <output>{review.diffSource.type}</output>
        <button onClick={() => review.toggleViewed('a.ts')}>Viewed while loading</button>
      </>
    );
  }
  render(
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider initialConfig={{}}>
        <ReviewProvider>
          <SaveReviewBoundary api={api}>
            <Controls />
          </SaveReviewBoundary>
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
  await screen.findByText('directory');
  fireEvent.click(screen.getByText('Finish hydrated'));
  expect(api.saveReview).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('still loading');
  fireEvent.click(screen.getByText('Viewed while loading'));
  await act(async () =>
    resumed.resolve({
      comments: [
        {
          id: 'saved',
          filePath: 'a.ts',
          lineRange: null,
          body: 'Preserve feedback',
          category: 'note',
          suggestion: null,
        },
      ],
    })
  );
  fireEvent.click(screen.getByText('Finish hydrated'));
  await waitFor(() => expect(api.acknowledgeReviewSave).toHaveBeenCalledWith('complete'));
  expect(api.saveReview).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      files: [
        expect.objectContaining({
          viewed: true,
          comments: [expect.objectContaining({ body: 'Preserve feedback' })],
        }),
      ],
    })
  );
});

it('prefers acknowledged handoff to legacy submission without claiming disk publication', async () => {
  const handoff = deferred<void>();
  const api = {
    submitReview: vi.fn(),
    handoffReview: vi.fn(() => handoff.promise),
    saveAndQuit: vi.fn(),
  };
  function Finish() {
    const save = useSaveReview(api);
    return <button onClick={save}>Handoff finish</button>;
  }
  render(
    <ConfigProvider initialConfig={{}}>
      <ReviewProvider initialFiles={payload.files} initialSource={payload.source}>
        <SaveReviewBoundary api={api}>
          <Finish />
        </SaveReviewBoundary>
      </ReviewProvider>
    </ConfigProvider>
  );
  fireEvent.click(screen.getByText('Handoff finish'));
  await waitFor(() => expect(api.handoffReview).toHaveBeenCalledTimes(1));
  expect(api.submitReview).not.toHaveBeenCalled();
  expect(api.saveAndQuit).not.toHaveBeenCalled();
  await act(async () => handoff.resolve());
  expect(api.saveAndQuit).toHaveBeenCalledOnce();
  expect(screen.getByText(/The save outcome is unknown/)).toBeTruthy();
});

it.each([false, true])(
  'keeps handoff failures distinguishable from publication, uncertain=%s',
  async uncertain => {
    const api = {
      submitReview: vi.fn(),
      saveAndQuit: vi.fn(),
      handoffReview: vi.fn(async () => {
        throw Object.assign(new Error('handoff failed'), { uncertain });
      }),
    };
    function Controls() {
      const review = useReview();
      const save = useSaveReview(api);
      return (
        <>
          <button onClick={save}>Handoff failure</button>
          <button onClick={() => review.toggleViewed('a.ts')}>Edit after handoff</button>
          <output>{review.files[0].viewed ? 'Viewed' : 'Unviewed'}</output>
        </>
      );
    }
    render(
      <ConfigProvider initialConfig={{}}>
        <ReviewProvider initialFiles={payload.files} initialSource={payload.source}>
          <SaveReviewBoundary api={api}>
            <Controls />
          </SaveReviewBoundary>
        </ReviewProvider>
      </ConfigProvider>
    );
    fireEvent.click(screen.getByText('Handoff failure'));
    await screen.findByText(/The host could not accept the review state/);
    expect(api.submitReview).not.toHaveBeenCalled();
    expect(api.saveAndQuit).not.toHaveBeenCalled();
    expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(uncertain);
    fireEvent.click(screen.getByText('Edit after handoff'));
    expect(screen.getByText(uncertain ? 'Unviewed' : 'Viewed')).toBeTruthy();
  }
);

it('keeps a synchronously thrown save failure in the unknown-outcome flow', async () => {
  const f = fixture();
  f.api.saveReview.mockImplementationOnce(() => {
    throw new Error('bridge disconnected');
  });
  fireEvent.click(screen.getByText('Finish'));
  await screen.findByText(/The save outcome is unknown/);
  act(() => {
    f.edit();
    f.save();
  });
  expect(screen.getByText('Unviewed')).toBeTruthy();
  expect(f.api.saveReview).toHaveBeenCalledOnce();
});

afterEach(() => vi.useRealTimers());

it.each([
  null,
  [],
  { status: 'mystery' },
  { status: 'saved' },
  { status: 'saved', receipt: '' },
  { status: 'failed', message: 'Incomplete' },
  { status: 'busy' },
])('retains the frozen review for a malformed or busy reply: %j', async reply => {
  const f = fixture();
  act(() => f.comment('Keep me'));
  fireEvent.click(screen.getByText('Finish'));
  await act(async () => f.publication.resolve(reply as ReviewSaveResult));
  expect(screen.getByText(/The save outcome is unknown/)).toBeTruthy();
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(true);
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  act(() => {
    f.save();
    f.comment('Blocked');
  });
  expect(f.api.saveReview).toHaveBeenCalledOnce();
  expect(screen.getByText('Comments: 1')).toBeTruthy();
});

it('rejects a late successful receipt after the shell deadline until explicit inspection', async () => {
  vi.useFakeTimers();
  const f = fixture();
  fireEvent.click(screen.getByText('Finish'));
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expect(screen.getByText(/The save outcome is unknown/)).toBeTruthy();
  await act(async () => f.publication.resolve({ status: 'saved', receipt: 'late' }));
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  act(() => {
    f.save();
    f.edit();
  });
  expect(f.api.saveReview).toHaveBeenCalledOnce();
  expect(screen.getByText('Unviewed')).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByText('Check publication status')));
  expect(f.api.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('disk-receipt');
  f.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('invalidates late replies and timers after explicit host failure, preserving comments and retry', async () => {
  vi.useFakeTimers();
  const f = fixture();
  act(() => f.comment('Before'));
  fireEvent.click(screen.getByText('Finish'));
  act(() => f.fail());
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
  act(() => f.comment('After'));
  await act(async () => f.publication.resolve({ status: 'saved', receipt: 'obsolete' }));
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  expect(screen.getByText('Comments: 2')).toBeTruthy();
  expect(vi.getTimerCount()).toBe(0);
  f.api.saveReview.mockResolvedValueOnce({ status: 'saved', receipt: 'retry' });
  await act(async () => fireEvent.click(screen.getByText('Finish')));
  expect(f.api.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('retry');
  expect(f.api.saveReview.mock.calls[1][0].files[0].comments.map(comment => comment.body)).toEqual([
    'Before',
    'After',
  ]);
});

it('does not acknowledge replies after boundary disposal and removes input capture', async () => {
  vi.useFakeTimers();
  const f = fixture();
  fireEvent.click(screen.getByText('Finish'));
  f.unmount();
  await act(async () => f.publication.resolve({ status: 'saved', receipt: 'disposed' }));
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  const listener = vi.fn();
  document.addEventListener('keydown', listener);
  try {
    fireEvent.keyDown(document, { key: 'f' });
    expect(listener).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    document.removeEventListener('keydown', listener);
  }
});

it('retains the frozen snapshot across API replacement and ignores both obsolete replies and callbacks', async () => {
  const f = fixture();
  fireEvent.click(screen.getByText('Finish'));
  const oldFailure = f.api.onSaveFailed.mock.calls[0][0];
  const next = {
    ...f.api,
    acknowledgeReviewSave: vi.fn(),
    getSaveResult: vi.fn(async () => ({ status: 'saved', receipt: 'inspected' }) as const),
  };
  f.replaceAPI(next);
  act(() => oldFailure());
  await act(async () => f.publication.resolve({ status: 'saved', receipt: 'replaced' }));
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  expect(next.acknowledgeReviewSave).not.toHaveBeenCalled();
  expect(screen.getByText(/The save outcome is unknown/)).toBeTruthy();
  act(() => {
    f.save();
    f.edit();
  });
  expect(f.api.saveReview).toHaveBeenCalledOnce();
  expect(screen.getByText('Unviewed')).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByText('Check publication status')));
  expect(next.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('inspected');
});

it.each([
  null,
  { status: 'busy' },
  { status: 'saved', receipt: 4 },
  { status: 'failed', detail: 'Missing message' },
])('keeps inspection of %j locked without resending state', async reply => {
  const f = fixture();
  fireEvent.click(screen.getByText('Finish'));
  await act(async () => f.publication.reject(new Error('Lost reply')));
  f.api.getSaveResult.mockResolvedValueOnce(reply as never);
  await act(async () => fireEvent.click(screen.getByText('Check publication status')));
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(true);
  act(() => f.save());
  expect(f.api.saveReview).toHaveBeenCalledOnce();
});

it('recovers on an inspected known failure and preserves feedback for explicit retry', async () => {
  const f = fixture();
  act(() => f.comment('Preserved'));
  fireEvent.click(screen.getByText('Finish'));
  await act(async () => f.publication.reject(new Error('Lost reply')));
  f.api.getSaveResult.mockResolvedValueOnce({
    status: 'failed',
    message: 'Cannot save',
    detail: 'Disk full',
  } as never);
  await act(async () => fireEvent.click(screen.getByText('Check publication status')));
  expect(screen.getByRole('alert').textContent).toContain('Disk full');
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
  expect(screen.getByText('Comments: 1')).toBeTruthy();
  expect(f.api.saveReview).toHaveBeenCalledOnce();
});

it('contains synchronous inspection and acknowledgement failures', async () => {
  const f = fixture();
  f.api.acknowledgeReviewSave.mockImplementation(() => {
    throw new Error('Ack lost');
  });
  fireEvent.click(screen.getByText('Finish'));
  await act(async () => f.publication.resolve({ status: 'saved', receipt: 'committed' }));
  expect(screen.getByText(/The save outcome is unknown/)).toBeTruthy();
  f.api.getSaveResult.mockImplementationOnce(() => {
    throw new Error('Inspection disconnected');
  });
  await act(async () => fireEvent.click(screen.getByText('Check publication status')));
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(true);
  expect(f.api.saveReview).toHaveBeenCalledOnce();
});

it('creates a live protocol owner after StrictMode effect replay', async () => {
  const f = fixture(true);
  fireEvent.click(screen.getByText('Finish'));
  await act(async () => f.publication.resolve({ status: 'saved', receipt: 'strict' }));
  expect(f.api.saveReview).toHaveBeenCalledOnce();
  expect(f.api.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('strict');
});

it('blocks keyboard and duplicate Finish input in the synchronous interval before inert commits', async () => {
  const f = fixture();
  act(() => {
    f.save();
    expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
    fireEvent.keyDown(document, { key: 'f' });
    fireEvent.click(screen.getByText('Finish'));
    f.edit();
  });
  expect(f.shortcut).not.toHaveBeenCalled();
  expect(f.api.saveReview).toHaveBeenCalledOnce();
  expect(screen.getByText('Unviewed')).toBeTruthy();
  await act(async () =>
    f.publication.resolve({ status: 'failed', message: 'Refused', detail: 'Retry explicitly' })
  );
});

it('bounds status inspection and ignores its late saved receipt without resending', async () => {
  vi.useFakeTimers();
  const f = fixture();
  const inspection = deferred<ReviewSaveResult>();
  f.api.getSaveResult.mockReturnValueOnce(inspection.promise as never);
  fireEvent.click(screen.getByText('Finish'));
  await act(async () => f.publication.reject(new Error('Lost reply')));
  fireEvent.click(screen.getByText('Check publication status'));
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  await act(async () => inspection.resolve({ status: 'saved', receipt: 'late inspection' }));
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(true);
  expect(f.api.saveReview).toHaveBeenCalledOnce();
  f.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
