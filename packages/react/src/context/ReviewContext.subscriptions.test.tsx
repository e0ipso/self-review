import ReplyDisplay from '../components/Comments/ReplyDisplay';
import React from 'react';
import { it, expect, vi } from 'vitest';
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
const leafRenders = vi.hoisted(() => ({ markdown: 0 }));
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => {
    leafRenders.markdown++;
    return <p>{children}</p>;
  },
}));

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

it('does not re-render a reply leaf for unrelated comments or viewed flags', () => {
  let review!: ReviewContextValue;
  leafRenders.markdown = 0;
  function Probe() {
    review = useReview();
    return null;
  }
  const reply = { id: 'r', body: 'unchanged reply' };
  const view = render(
    <ConfigProvider>
      <ReviewProvider
        initialFiles={[
          { oldPath: 'a', newPath: 'a', changeType: 'modified', isBinary: false, hunks: [] },
        ]}
      >
        <Probe />
        <ReplyDisplay commentId='root' reply={reply} />
      </ReviewProvider>
    </ConfigProvider>
  );
  const before = leafRenders.markdown;
  expect(before).toBeGreaterThan(0);
  act(() => review.addComment('a', null, 'unrelated', 'bug', null));
  act(() => review.toggleViewed('a'));
  expect(leafRenders.markdown).toBe(before);
  view.unmount();
});
