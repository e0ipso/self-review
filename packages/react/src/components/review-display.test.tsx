import React, { Profiler } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { DiffFile, DiffLoadPayload, ReviewComment } from '@self-review/types';
import type { ReviewAdapter } from '../adapter';
import { ConfigProvider } from '../context/ConfigContext';
import { ReviewProvider, useReview, type ReviewContextValue } from '../context/ReviewContext';
import { ReviewAdapterProvider } from '../context/ReviewAdapterContext';
import { DiffNavigationProvider } from '../context/DiffNavigationContext';
import { SingleFileReview } from '../SingleFileReview';
import { installBrowserApiStubs } from '../test-helpers';
import FileTree from './FileTree';
import Toolbar from './Toolbar';
import DiffViewer from './DiffViewer/DiffViewer';

installBrowserApiStubs();
afterEach(cleanup);
const source = { type: 'directory' as const, sourcePath: '/repo' };
const file = (path: string): DiffFile => ({
  oldPath: path,
  newPath: path,
  changeType: 'modified',
  isBinary: false,
  hunks: [],
});
const comment = (id: string, path = 'a'): ReviewComment => ({
  id,
  filePath: path,
  body: 'Finding ' + id,
  category: 'bug',
  lineRange: null,
  suggestion: null,
});
const initialFiles = [file('a'), file('b')];

function Parts({ navigationRender }: { navigationRender?: () => void }) {
  return (
    <DiffNavigationProvider>
      <Profiler id='navigation' onRender={() => navigationRender?.()}>
        <FileTree />
      </Profiler>
      <Toolbar />
      <DiffViewer />
    </DiffNavigationProvider>
  );
}

it('derives the bulk file action from actual defaults and individual expansion', () => {
  render(
    <ConfigProvider>
      <ReviewProvider initialFiles={Array.from({ length: 51 }, (_, i) => file(String(i)))}>
        <Parts />
      </ReviewProvider>
    </ConfigProvider>
  );
  expect(screen.getByTestId('expand-all-btn').getAttribute('aria-label')).toBe('Expand all files');
  fireEvent.click(screen.getByTestId('expand-all-btn'));
  expect(screen.getByTestId('collapse-all-btn').getAttribute('aria-label')).toBe(
    'Collapse all files'
  );
  const header = within(screen.getByTestId('file-header-0'));
  fireEvent.click(header.getByRole('button', { name: 'Collapse 0' }));
  expect(screen.getByTestId('expand-all-btn')).toBeTruthy();
  fireEvent.click(screen.getByTestId('expand-all-btn'));
  expect(header.getByRole('button', { name: 'Collapse 0' }).getAttribute('aria-expanded')).toBe(
    'true'
  );
});

it('keeps first-seen defaults on updates and admits no lazy load before expansion on replacement', async () => {
  let push!: (payload: DiffLoadPayload) => void;
  const loadFileContent = vi.fn(async (_path: string) => []);
  const adapter: ReviewAdapter = {
    loadDiff: async () => ({ files: initialFiles, source }),
    onDiffLoad: callback => {
      push = callback;
      return () => {};
    },
    loadFileContent,
  };
  render(
    <ConfigProvider>
      <ReviewAdapterProvider adapter={adapter}>
        <ReviewProvider>
          <Parts />
        </ReviewProvider>
      </ReviewAdapterProvider>
    </ConfigProvider>
  );
  await screen.findByRole('button', { name: 'Collapse a' });
  fireEvent.click(screen.getByRole('button', { name: 'Collapse a' }));
  const unloaded = (path: string) => ({ ...file(path), contentLoaded: false });
  await act(async () =>
    push({ files: [unloaded('a'), unloaded('b'), unloaded('c')], source, isLargePayload: true })
  );
  expect(screen.getByRole('button', { name: 'Expand a' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Collapse b' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Expand c' })).toBeTruthy();
  expect(loadFileContent.mock.calls.map(([path]) => path)).toEqual(['b']);
  loadFileContent.mockClear();
  act(() =>
    push({
      files: [unloaded('a'), unloaded('b')],
      source: { ...source, sourcePath: '/replacement' },
      isLargePayload: true,
    })
  );
  expect(screen.getByRole('button', { name: 'Expand all files' })).toBeTruthy();
  expect(loadFileContent).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Expand all files' })));
  expect(loadFileContent.mock.calls.map(([path]) => path).sort()).toEqual(['a', 'b']);
});

it('keeps individual and bulk comment disclosure in agreement and retains hidden reply drafts', () => {
  render(
    <ConfigProvider>
      <ReviewProvider
        initialFiles={initialFiles}
        initialComments={[comment('c1'), comment('c2', 'b')]}
      >
        <Parts />
      </ReviewProvider>
    </ConfigProvider>
  );
  fireEvent.click(screen.getByTestId('reply-btn-c1'));
  const draft = screen.getByTestId('reply-input').querySelector('textarea')!;
  fireEvent.change(draft, { target: { value: 'unfinished reply' } });
  fireEvent.click(screen.getByTestId('comment-collapse-toggle-c1'));
  fireEvent.click(screen.getByTestId('comment-collapse-toggle-c2'));
  expect(screen.getByTestId('expand-all-comments-btn')).toBeTruthy();
  expect(draft.closest('[hidden]')).toBeTruthy();
  fireEvent.click(screen.getByTestId('expand-all-comments-btn'));
  expect(screen.getByTestId('comment-collapse-toggle-c1').getAttribute('aria-expanded')).toBe(
    'true'
  );
  expect(screen.getByTestId('reply-input').querySelector('textarea')).toBe(draft);
  expect(draft.value).toBe('unfinished reply');
  fireEvent.click(screen.getByTestId('collapse-all-comments-btn'));
  fireEvent.click(screen.getByTestId('comment-collapse-toggle-c1'));
  expect(screen.getByTestId('collapse-all-comments-btn')).toBeTruthy();
});

it('does not render navigation for body/reply edits, but updates counts and viewed progress', () => {
  let review!: ReviewContextValue;
  function Probe() {
    review = useReview();
    return null;
  }
  const navigationRender = vi.fn();
  render(
    <ConfigProvider>
      <ReviewProvider initialFiles={initialFiles} initialComments={[comment('c1')]}>
        <Parts navigationRender={navigationRender} />
        <Probe />
      </ReviewProvider>
    </ConfigProvider>
  );
  const before = navigationRender.mock.calls.length;
  act(() => review.editComment('c1', { body: 'edited body' }));
  act(() => review.addReply('c1', 'reply body'));
  expect(navigationRender).toHaveBeenCalledTimes(before);
  act(() => review.addComment('b', null, 'new finding', 'bug', null));
  expect(screen.getByTestId('file-entry-b').textContent).toContain('1');
  expect(screen.getByTestId('review-stats').textContent).toBe('2');
  act(() => review.toggleViewed('b'));
  expect(screen.getByTestId('viewed-toggle-b').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
});

it('scopes typed commands and legacy events when bare review providers share configuration', () => {
  render(
    <ConfigProvider>
      {['left', 'right'].map(id => (
        <div key={id} data-testid={id}>
          <ReviewProvider initialFiles={[file('a')]} initialComments={[comment('c1')]}>
            <Parts />
          </ReviewProvider>
        </div>
      ))}
    </ConfigProvider>
  );
  const left = within(screen.getByTestId('left'));
  const right = within(screen.getByTestId('right'));
  fireEvent.click(left.getByRole('button', { name: 'Collapse all files' }));
  expect(right.getByRole('button', { name: 'Collapse a' })).toBeTruthy();
  fireEvent.click(left.getByRole('button', { name: 'Expand all files' }));
  const root = screen.getByTestId('left').querySelector('[data-review-display-root]')!;
  fireEvent(
    root,
    new CustomEvent('toggle-all-comments', { detail: { collapsed: true }, bubbles: true })
  );
  expect(left.getByTestId('comment-collapse-toggle-c1').getAttribute('aria-expanded')).toBe(
    'false'
  );
  expect(right.getByTestId('comment-collapse-toggle-c1').getAttribute('aria-expanded')).toBe(
    'true'
  );
  fireEvent(
    document.querySelector('.self-review')!,
    new CustomEvent('toggle-all-sections', { detail: { expanded: false } })
  );
  expect(left.getByRole('button', { name: 'Collapse a' })).toBeTruthy();
  expect(right.getByRole('button', { name: 'Collapse a' })).toBeTruthy();
});

it('retains unambiguous legacy container commands and ignores malformed payloads', () => {
  render(
    <ConfigProvider>
      <ReviewProvider initialFiles={initialFiles}>
        <Parts />
      </ReviewProvider>
    </ConfigProvider>
  );
  const container = document.querySelector('.self-review')!;
  fireEvent(container, new CustomEvent('toggle-all-sections', { detail: { expanded: false } }));
  expect(screen.getByRole('button', { name: 'Expand all files' })).toBeTruthy();
  fireEvent(container, new CustomEvent('toggle-all-sections', { detail: { expanded: 'yes' } }));
  expect(screen.getByRole('button', { name: 'Expand a' })).toBeTruthy();
});

it('lets a single-file review use the same disclosure owner without a new provider argument', () => {
  render(<SingleFileReview file={file('a')} />);
  fireEvent.click(screen.getByRole('button', { name: 'Collapse a' }));
  expect(screen.getByRole('button', { name: 'Expand a' }).getAttribute('aria-expanded')).toBe(
    'false'
  );
  fireEvent.click(screen.getByTestId('add-file-comment-a'));
  expect(screen.getByRole('button', { name: 'Collapse a' })).toBeTruthy();
});

it('uses visible files for the expansion threshold and leaves hidden-file choices alone', () => {
  const files = [
    file('a'),
    ...Array.from({ length: 51 }, (_, i) => ({ ...file('new' + i), isUntracked: true })),
  ];
  render(
    <ConfigProvider initialConfig={{ showUntracked: false }}>
      <ReviewProvider
        initialFiles={files}
        initialSource={{ type: 'git', repository: '/repo', gitDiffArgs: '' }}
      >
        <Parts />
      </ReviewProvider>
    </ConfigProvider>
  );
  expect(screen.getByRole('button', { name: 'Collapse a' })).toBeTruthy();
  fireEvent.click(screen.getByTestId('collapse-all-btn'));
  fireEvent.click(screen.getByTestId('toggle-untracked-btn'));
  expect(screen.getByRole('button', { name: 'Expand a' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Expand new0' })).toBeTruthy();
});

it('isolates a nested configuration container legacy command even when it bubbles', () => {
  render(
    <ConfigProvider>
      <ReviewProvider initialFiles={[file('a')]}>
        <Parts />
        <ConfigProvider>
          <ReviewProvider initialFiles={[file('a')]}>
            <div data-testid='inner'>
              <Parts />
            </div>
          </ReviewProvider>
        </ConfigProvider>
      </ReviewProvider>
    </ConfigProvider>
  );
  const inner = screen.getByTestId('inner');
  fireEvent(
    inner.closest('.self-review')!,
    new CustomEvent('toggle-all-sections', { detail: { expanded: false }, bubbles: true })
  );
  expect(within(inner).getByRole('button', { name: 'Expand a' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Collapse a' })).toHaveLength(1);
});
