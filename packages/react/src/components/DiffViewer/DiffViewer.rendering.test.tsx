import React from 'react';
import { it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider, useReview, type ReviewContextValue } from '../../context/ReviewContext';
import DiffViewer from './DiffViewer';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();
const renders = vi.hoisted(() => new Map<string, number>());
vi.mock('./FileSectionHeader', () => ({
  FileSectionHeader: ({ filePath }: { filePath: string }) => {
    renders.set(filePath, (renders.get(filePath) ?? 0) + 1);
    return <div>{filePath}</div>;
  },
}));
it('does not rerender an unrelated file section when another file gets a comment', () => {
  let review!: ReviewContextValue;
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
        <DiffViewer />
        <Probe />
      </ReviewProvider>
    </ConfigProvider>
  );
  const before = renders.get('a');
  const beforeB = renders.get('b')!;
  act(() => review.addComment('b', null, 'on B', 'bug', null));
  expect(renders.get('a')).toBe(before);
  expect(renders.get('b')).toBeGreaterThan(beforeB);
});
