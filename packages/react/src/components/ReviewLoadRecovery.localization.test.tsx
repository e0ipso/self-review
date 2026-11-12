import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { DiffLoadPayload, ResumeLoadPayload } from '@self-review/types';
import { LocalizationProvider } from '../localization/LocalizationContext';
import { SPANISH_REVIEW } from '../../../../src/shared/spanish-review';
import { ReviewAdapterProvider } from '../context/ReviewAdapterContext';
import { ConfigProvider } from '../context/ConfigContext';
import { ReviewProvider, useReview, type ReviewContextValue } from '../context/ReviewContext';
import type { ReviewAdapter } from '../adapter';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();
const payload: DiffLoadPayload = { files: [], source: { type: 'directory', sourcePath: '/a' } };
function mount(adapter: ReviewAdapter, spanish: boolean) {
  let review!: ReviewContextValue;
  function Probe() {
    review = useReview();
    return null;
  }
  const view = render(
    <LocalizationProvider locale={spanish ? 'es' : 'en'} messages={spanish ? SPANISH_REVIEW : {}}>
      <ReviewAdapterProvider adapter={adapter}>
        <ConfigProvider>
          <ReviewProvider>
            <Probe />
          </ReviewProvider>
        </ConfigProvider>
      </ReviewAdapterProvider>
    </LocalizationProvider>
  );
  return { ...view, review: () => review };
}
it.each([false, true])(
  'presents generated default failures and retries without changing public state, Spanish=%s',
  async spanish => {
    const loadDiff = vi.fn().mockRejectedValueOnce(new Error('')).mockResolvedValue(payload);
    const view = mount({ loadDiff }, spanish);
    expect((await screen.findByRole('alert')).textContent).toContain(
      spanish ? 'La solicitud al anfitrión falló.' : 'The host request failed.'
    );
    expect(view.review().loadError).toBe('The host request failed.');
    expect(loadDiff).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', {
        name: spanish ? 'Reintentar cargar la revisión' : 'Retry loading review',
      })
    );
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(loadDiff).toHaveBeenCalledTimes(2);
  }
);
it.each([false, true])(
  'localizes missing acknowledgements but keeps external diagnostics verbatim, Spanish=%s',
  async spanish => {
    const external = 'EHOST /server/review.xml: permission denied';
    const loadResumedReview = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error(external))
      .mockResolvedValue(null);
    const view = mount({ loadDiff: async () => payload, loadResumedReview }, spanish);
    expect((await screen.findByRole('alert')).textContent).toContain(
      spanish
        ? 'El anfitrión no confirmó los comentarios guardados.'
        : 'The host did not acknowledge saved feedback.'
    );
    expect(view.review().resumeError).toBe('The host did not acknowledge saved feedback.');
    fireEvent.click(
      screen.getByRole('button', {
        name: spanish
          ? 'Reintentar cargar los comentarios guardados'
          : 'Retry loading saved feedback',
      })
    );
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(external));
    fireEvent.click(
      screen.getByRole('button', {
        name: spanish
          ? 'Reintentar cargar los comentarios guardados'
          : 'Retry loading saved feedback',
      })
    );
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  }
);
it('localizes stale remote feedback while retaining ownership against late results', async () => {
  const remotePayload = (head: string): DiffLoadPayload => ({
    ...payload,
    source: { type: 'git', repository: '/clone', gitDiffArgs: `base...${head}` },
    remote: {
      remoteUrl: 'https://github.com/o/r/pull/1',
      remoteBaseSha: 'base',
      remoteHeadSha: head,
      remoteForge: 'github',
      threadSyncAvailable: true,
      temporaryClone: false,
    },
  });
  let push!: (value: DiffLoadPayload) => void;
  let resumePush!: (value: ResumeLoadPayload) => void;
  let resolve!: (value: ResumeLoadPayload) => void;
  const loadResumedReview = vi.fn(
    () =>
      new Promise<ResumeLoadPayload>(done => {
        resolve = done;
      })
  );
  const view = mount(
    {
      loadDiff: async () => remotePayload('old'),
      loadResumedReview,
      onDiffLoad: callback => {
        push = callback;
        return () => {};
      },
      onResumeLoad: callback => {
        resumePush = callback;
        return () => {};
      },
    },
    true
  );
  await waitFor(() => expect(loadResumedReview).toHaveBeenCalledOnce());
  act(() => push(remotePayload('new')));
  await act(async () => view.review().retryResume!());
  expect(screen.getByRole('alert').textContent).toContain(
    'Los comentarios guardados pertenecen a una versión remota anterior.'
  );
  expect(view.review().resumeError).toBe(
    'Saved feedback belongs to an earlier remote snapshot. The host must supply feedback for the current snapshot.'
  );
  await act(async () => resolve({ comments: [] }));
  expect(screen.getByRole('alert').textContent).toContain('versión remota anterior');
  fireEvent.click(
    screen.getByRole('button', { name: 'Reintentar cargar los comentarios guardados' })
  );
  expect(loadResumedReview).toHaveBeenCalledOnce();
  act(() => resumePush({ comments: [] }));
  expect(screen.queryByRole('alert')).toBeNull();
});
