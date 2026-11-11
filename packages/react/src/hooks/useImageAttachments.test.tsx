import React from 'react';
import { act, renderHook, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import type { Attachment } from '@self-review/types';
import { useImageAttachments, ATTACHMENT_MAX_COUNT } from './useImageAttachments';
import { AttachmentProcessingStatus } from '../components/Comments/AttachmentProcessing';
import { LocalizationProvider } from '../localization/LocalizationContext';

const file = (name: string) => new File(['png'], name, { type: 'image/png' });
const image = (id: string): Attachment => ({
  id,
  fileName: id,
  mediaType: 'image/png',
  data: new ArrayBuffer(4),
});
it('retains each success, reports failures and retries only the failed image', async () => {
  const attached = vi.fn();
  let finish!: (value: Attachment) => void;
  const process = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    )
    .mockRejectedValueOnce(new Error('bad image'))
    .mockResolvedValueOnce(image('retry'));
  const { result } = renderHook(() => useImageAttachments({ onAttach: attached, process }));
  act(() => result.current.enqueue([file('good.png'), file('bad.png')]));
  expect(process).toHaveBeenCalledTimes(1);
  expect(result.current.pending).toBe(true);
  await act(async () => finish(image('good')));
  expect(process).toHaveBeenCalledTimes(2);
  expect(attached).toHaveBeenCalledWith([image('good')]);
  expect(result.current.jobs).toHaveLength(1);
  expect(result.current.jobs[0].status).toBe('error');
  expect(result.current.pending).toBe(false);
  await act(async () => result.current.retry(result.current.jobs[0].id));
  expect(attached).toHaveBeenLastCalledWith([image('retry')]);
  expect(result.current.jobs).toHaveLength(0);
});
it('ignores late work after owner replacement or unmount and aborts its signal', async () => {
  const attached = vi.fn();
  let finish!: (value: Attachment) => void;
  let signal!: AbortSignal;
  const process = vi.fn((_file, inputSignal) => {
    signal = inputSignal!;
    return new Promise<Attachment>(resolve => {
      finish = resolve;
    });
  });
  const { result, rerender, unmount } = renderHook(
    ({ owner }) => useImageAttachments({ onAttach: attached, owner, process }),
    { initialProps: { owner: 'a' } }
  );
  act(() => result.current.enqueue([file('pending.png')]));
  rerender({ owner: 'b' });
  expect(signal.aborted).toBe(true);
  await act(async () => finish(image('old')));
  expect(attached).not.toHaveBeenCalled();
  act(() => result.current.enqueue([file('pending.png')]));
  unmount();
  await act(async () => finish(image('unmounted')));
  expect(attached).not.toHaveBeenCalled();
});
it('bounds retained selections before processing and announces localized retry errors in RTL', async () => {
  const process = vi.fn().mockRejectedValue(new Error('bad'));
  function Probe() {
    const ingestion = useImageAttachments({ onAttach: vi.fn(), process });
    return (
      <>
        <button
          onClick={() =>
            ingestion.enqueue(Array.from({ length: ATTACHMENT_MAX_COUNT + 1 }, () => file('large')))
          }
        >
          Many
        </button>
        <button onClick={() => ingestion.enqueue([file('bad.png')])}>One</button>
        <AttachmentProcessingStatus ingestion={ingestion} />
      </>
    );
  }
  render(
    <LocalizationProvider
      locale='ar'
      direction='rtl'
      messages={{ Retry: 'إعادة', 'Image could not be decoded.': 'تعذر فتح الصورة' }}
    >
      <Probe />
    </LocalizationProvider>
  );
  fireEvent.click(screen.getByText('Many'));
  expect(screen.getByRole('alert').textContent).toContain(new Intl.NumberFormat('ar').format(8));
  expect(process).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('One'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('تعذر فتح الصورة'));
  expect(screen.getByRole('button', { name: 'إعادة' })).toBeTruthy();
  expect(screen.getByRole('alert').closest('[dir]')?.getAttribute('dir')).toBe('rtl');
});

it('can ingest after StrictMode effect replay', async () => {
  const attached = vi.fn();
  const process = vi.fn(async () => image('strict'));
  const { result } = renderHook(() => useImageAttachments({ onAttach: attached, process }), {
    wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode>,
  });
  await act(async () => result.current.enqueue([file('strict.png')]));
  expect(attached).toHaveBeenCalledWith([image('strict')]);
});
