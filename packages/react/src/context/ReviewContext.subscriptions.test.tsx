import React from 'react';
import { it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { ConfigProvider } from './ConfigContext';
import {
  ReviewProvider,
  useReview,
  useFileReview,
  useReviewCommands,
  type ReviewContextValue,
} from './ReviewContext';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();

it('keeps file and command subscriptions quiet for unrelated file changes', () => {
  let review!: ReviewContextValue;
  let fileRenders = 0;
  let commandRenders = 0;
  function File() {
    useFileReview('a');
    fileRenders++;
    return null;
  }
  function Commands() {
    useReviewCommands();
    commandRenders++;
    return null;
  }
  function Probe() {
    review = useReview();
    return null;
  }
  const files = ['a', 'b'].map(path => ({
    oldPath: path,
    newPath: path,
    changeType: 'modified' as const,
    isBinary: false,
    hunks: [],
  }));
  render(
    <ConfigProvider>
      <ReviewProvider initialFiles={files}>
        <File />
        <Commands />
        <Probe />
      </ReviewProvider>
    </ConfigProvider>
  );
  const before = { fileRenders, commandRenders };
  act(() => review.addComment('b', null, 'body', 'bug', null));
  const id = review.files.find(f => f.path === 'b')!.comments[0].id;
  act(() => review.editComment(id, { body: 'edited' }));
  act(() => review.addReply(id, 'reply'));
  act(() => review.toggleViewed('b'));
  expect({ fileRenders, commandRenders }).toEqual(before);
  act(() => review.toggleViewed('a'));
  expect(fileRenders).toBe(before.fileRenders + 1);
});
