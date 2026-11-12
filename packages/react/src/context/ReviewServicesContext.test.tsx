import React from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { DiffFile } from '@self-review/types';
import { ReviewProviders } from '../ReviewProviders';
import { ReviewPanel } from '../ReviewPanel';
import { useFileReview, useReviewCommands } from './ReviewContext';
import { useReviewServices, type ReviewServices } from './ReviewServicesContext';
import { useReviewState } from '../hooks/useReviewState';
import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();
const file: DiffFile = {
  oldPath: 'a.txt',
  newPath: 'a.txt',
  changeType: 'added',
  isBinary: false,
  hunks: [],
};
function Probe({ name }: { name: string }) {
  const commands = useReviewCommands();
  const comments = useFileReview('a.txt')?.comments ?? [];
  const { now } = useReviewServices();
  return (
    <div>
      <button onClick={() => commands.addComment('a.txt', null, 'Body', 'note', null)}>
        Comment {name}
      </button>
      <button onClick={() => commands.addReply(comments[0].id, 'Reply')}>Reply {name}</button>
      <output data-testid={name}>{JSON.stringify({ comments, time: now().toISOString() })}</output>
    </div>
  );
}
function services(prefix: string, year: number): ReviewServices {
  let id = 0;
  return { createId: () => `${prefix}-${++id}`, now: () => new Date(`${year}-01-02T03:04:05Z`) };
}

it('scopes deterministic comment, reply and clock dependencies to independent review providers', () => {
  const adapter = {
    loadDiff: async () => ({
      files: [],
      source: { type: 'directory' as const, sourcePath: '/empty' },
    }),
  };
  render(
    <>
      <ReviewProviders adapter={adapter} initialFiles={[file]} services={services('left', 2001)}>
        <Probe name='left' />
      </ReviewProviders>
      <ReviewProviders adapter={adapter} initialFiles={[file]} services={services('right', 2002)}>
        <Probe name='right' />
      </ReviewProviders>
    </>
  );
  for (const name of ['left', 'right']) {
    fireEvent.click(screen.getByText(`Comment ${name}`));
    fireEvent.click(screen.getByText(`Reply ${name}`));
    const value = JSON.parse(screen.getByTestId(name).textContent!);
    expect(value.comments[0].id).toBe(`${name}-1`);
    expect(value.comments[0].replies[0].id).toBe(`${name}-2`);
    expect(value.comments[0].replies[0].body).toBe('Reply');
    expect(value.time).toBe(`${name === 'left' ? 2001 : 2002}-01-02T03:04:05.000Z`);
  }
});

it('passes the optional services through ReviewPanel without changing its host contract', async () => {
  const adapter = {
    loadDiff: async () => ({
      files: [file],
      source: { type: 'directory' as const, sourcePath: '/a' },
    }),
  };
  render(
    <ReviewPanel adapter={adapter} services={services('panel', 2003)}>
      <Probe name='panel' />
    </ReviewPanel>
  );
  await screen.findByTestId('file-section-a.txt');
  fireEvent.click(screen.getByText('Comment panel'));
  expect(JSON.parse(screen.getByTestId('panel').textContent!).comments[0].id).toBe('panel-1');
});

it('retains cryptographic UUID defaults for standalone state hooks', () => {
  const { result } = renderHook(() => useReviewState());
  act(() =>
    result.current.setFiles([{ path: 'a.txt', changeType: 'added', viewed: false, comments: [] }])
  );
  act(() => result.current.addComment('a.txt', null, 'Body', 'note', null));
  act(() => result.current.addReply(result.current.files[0].comments[0].id, 'Reply'));
  const comment = result.current.files[0].comments[0];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  expect(comment.id).toMatch(uuid);
  expect(comment.replies![0].id).toMatch(uuid);
  expect(comment.id).not.toBe(comment.replies![0].id);
});
