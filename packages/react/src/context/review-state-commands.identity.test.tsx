import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useReviewState } from '../hooks/useReviewState';
import { ConfigProvider } from './ConfigContext';
import { ReviewProvider, useReview } from './ReviewContext';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();
import type { ReviewComment } from '@self-review/types';

const attachments = [{ id: 'asset', fileName: 'shot.png', mediaType: 'image/png' }];
const comment = {
  id: 'root',
  filePath: 'a',
  body: 'original',
  category: 'note',
  lineRange: { side: 'new' as const, start: 1, end: 1 },
  suggestion: { originalCode: 'a', proposedCode: 'b' },
  author: 'reviewer',
  remoteId: 'remote',
  severity: 'major' as const,
  attachments,
  extension: { retained: true },
  replies: [
    { id: 'first', body: 'one', attachments, remoteId: 'reply-remote' },
    { id: 'second', body: 'two' },
  ],
};

it('keeps comment ownership and lookup identity while applying valid Partial edits', () => {
  const { result } = renderHook(() => useReviewState());
  act(() =>
    result.current.setFiles(
      ['a', 'b'].map(path => ({
        path,
        changeType: 'modified',
        viewed: false,
        comments: path === 'a' ? [comment] : [],
      }))
    )
  );
  const before = result.current.files;
  const updates = {
    id: 'replacement',
    filePath: 'b',
    body: 'edited',
    confidence: 'high' as const,
    extension: { retained: false },
  };
  act(() => result.current.updateComment('root', updates));
  const edited = result.current.getCommentsForLine('a', 1, 'new')[0];
  expect(edited).toEqual({
    ...comment,
    body: 'edited',
    confidence: 'high',
    extension: { retained: false },
  });
  expect(edited.attachments).toBe(attachments);
  expect(edited.suggestion).toBe(comment.suggestion);
  expect(result.current.getCommentsForFile('b')).toEqual([]);
  expect(result.current.files[1]).toBe(before[1]);
  expect(before[0].comments[0]).toBe(comment);
  expect(updates.id).toBe('replacement');
  act(() => result.current.updateComment('root', { body: 'edited again' }));
  act(() => result.current.addReply('root', 'three'));
  expect(result.current.getCommentsForFile('a')[0].replies?.map(reply => reply.body)).toEqual([
    'one',
    'two',
    'three',
  ]);
  act(() => result.current.deleteComment('root'));
  expect(result.current.getCommentsForFile('a')).toEqual([]);
});

it('keeps reply identity and order through provider edits, later updates and deletion', () => {
  const files = ['a', 'b'].map(path => ({
    oldPath: path,
    newPath: path,
    changeType: 'modified' as const,
    isBinary: false,
    hunks: [],
  }));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ConfigProvider>
      <ReviewProvider initialFiles={files} initialComments={[comment]}>
        {children}
      </ReviewProvider>
    </ConfigProvider>
  );
  const { result } = renderHook(() => useReview(), { wrapper });
  act(() => result.current.editComment('root', { id: 'other', filePath: 'b', category: 'bug' }));
  act(() =>
    result.current.updateReply('root', 'first', {
      id: 'changed',
      body: 'edited reply',
      author: 'human',
    })
  );
  const edited = result.current.getCommentsForFile('a')[0];
  expect(edited.id).toBe('root');
  expect(edited.filePath).toBe('a');
  expect(edited.category).toBe('bug');
  expect(edited.replies?.[0]).toEqual({
    ...comment.replies[0],
    body: 'edited reply',
    author: 'human',
  });
  expect(edited.replies?.[1]).toBe(comment.replies[1]);
  act(() => result.current.updateReply('root', 'first', { body: 'again' }));
  act(() => result.current.addReply('root', 'three'));
  expect(result.current.getCommentsForFile('a')[0].replies?.map(reply => reply.body)).toEqual([
    'again',
    'two',
    'three',
  ]);
  act(() => result.current.deleteReply('root', 'first'));
  expect(result.current.getCommentsForFile('a')[0].replies?.map(reply => reply.body)).toEqual([
    'two',
    'three',
  ]);
  expect(result.current.getCommentsForFile('b')).toEqual([]);
});

it('keeps wholesale state replacement available to the standalone hook', () => {
  const { result } = renderHook(() => useReviewState());
  const replacement: ReviewComment = { ...comment, id: 'new', filePath: 'b' };
  const files = [
    { path: 'b', changeType: 'added' as const, viewed: true, comments: [replacement] },
  ];
  act(() => result.current.setFiles(files));
  expect(result.current.files).toBe(files);
  expect(result.current.getCommentsForFile('b')[0]).toBe(replacement);
});

it('ignores reply rename attempts independently of root edits and retains extension metadata', () => {
  const { result } = renderHook(() => useReviewState());
  act(() =>
    result.current.setFiles([
      { path: 'a', changeType: 'modified', viewed: false, comments: [comment] },
    ])
  );
  const updates = { id: 'renamed', body: 'edited', extra: { kept: true } };
  act(() => result.current.updateReply('root', 'first', updates));
  expect(result.current.files[0].comments[0].replies?.[0]).toEqual({
    ...comment.replies[0],
    body: 'edited',
    extra: { kept: true },
  });
  expect(comment.replies[0].body).toBe('one');
  act(() => result.current.updateReply('root', 'first', { id: undefined, body: 'again' }));
  act(() =>
    result.current.updateComment('root', { id: undefined, filePath: undefined, body: 'valid' })
  );
  expect(result.current.getCommentsForFile('a')[0].id).toBe('root');
  expect(result.current.getCommentsForFile('a')[0].filePath).toBe('a');
  act(() => result.current.deleteReply('root', 'first'));
  expect(result.current.files[0].comments[0].replies?.map(reply => reply.id)).toEqual(['second']);
});
