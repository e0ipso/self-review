import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { Attachment } from '@self-review/types';
import type { ReviewAdapter } from '../../adapter';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import { AttachmentImage } from './AttachmentImage';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

const attachment = (fileName: string): Attachment => ({
  id: fileName,
  fileName,
  mediaType: 'image/png',
});

function renderWithAdapter(adapter: ReviewAdapter, att: Attachment) {
  const view = render(
    <ReviewAdapterProvider adapter={adapter}>
      <AttachmentImage attachment={att} />
    </ReviewAdapterProvider>
  );
  const rerender = (next: Attachment) =>
    view.rerender(
      <ReviewAdapterProvider adapter={adapter}>
        <AttachmentImage attachment={next} />
      </ReviewAdapterProvider>
    );
  return { ...view, rerenderAttachment: rerender };
}

describe('AttachmentImage async reads', () => {
  let created: string[];
  let revoked: string[];

  beforeEach(() => {
    created = [];
    revoked = [];
    let n = 0;
    // jsdom implements neither method; the spies double as the leak ledger.
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:test/${++n}`;
      created.push(url);
      return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    });
  });

  afterEach(() => cleanup());

  it('leaves no unreclaimed blob URL when unmounted while a read is pending', async () => {
    const read = deferred<ArrayBuffer | null>();
    const adapter = { readAttachment: vi.fn(() => read.promise) } as unknown as ReviewAdapter;
    const view = renderWithAdapter(adapter, attachment('a.png'));

    view.unmount();
    await act(async () => read.resolve(new ArrayBuffer(4)));

    expect(revoked.slice().sort()).toEqual(created.slice().sort());
  });

  it('ignores a stale read that settles after a newer attachment and revokes every URL', async () => {
    const reads: Record<string, Deferred<ArrayBuffer | null>> = {
      'a.png': deferred(),
      'b.png': deferred(),
    };
    const adapter = {
      readAttachment: vi.fn((name: string) => reads[name].promise),
    } as unknown as ReviewAdapter;
    const view = renderWithAdapter(adapter, attachment('a.png'));

    view.rerenderAttachment(attachment('b.png'));
    await act(async () => reads['b.png'].resolve(new ArrayBuffer(2)));
    const shown = screen.getByRole('img').getAttribute('src');
    await act(async () => reads['a.png'].resolve(new ArrayBuffer(1)));

    expect(screen.getByRole('img').getAttribute('src')).toBe(shown);
    expect(created).toEqual([shown]);

    view.unmount();
    expect(revoked).toEqual(created);
  });

  it('clears a previous error when a new attachment loads', async () => {
    const adapter = {
      readAttachment: vi.fn(async (name: string) =>
        name === 'ok.png' ? new ArrayBuffer(1) : null
      ),
    } as unknown as ReviewAdapter;
    const view = renderWithAdapter(adapter, attachment('missing.png'));
    expect(await screen.findByText('Image not found')).toBeTruthy();

    view.rerenderAttachment(attachment('ok.png'));

    expect(await screen.findByRole('img')).toBeTruthy();
    expect(screen.queryByText('Image not found')).toBeNull();
  });
});
