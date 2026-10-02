import React, { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { DiffFile, DiffSource } from '@self-review/types';
import { ReviewProvider, useReview, type ReviewContextValue } from '../../context/ReviewContext';
import { ConfigProvider, useConfig } from '../../context/ConfigContext';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import type { ReviewAdapter } from '../../adapter';
import FileSection from './FileSection';
import { installBrowserApiStubs } from '../../test-helpers';

// Real provider stack and CommentInput: the draft lives in its state and survives only while
// the rendered block keeps its React identity.

const DRAFT_PLACEHOLDER = /add your review comment/i;

function makeFile(filePath: string, overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    oldPath: filePath,
    newPath: filePath,
    changeType: 'modified',
    isBinary: false,
    hunks: [],
    ...overrides,
  };
}

function makeAddedMarkdown(filePath: string, lines: string[]): DiffFile {
  return makeFile(filePath, {
    oldPath: '',
    changeType: 'added',
    hunks: [
      {
        header: `@@ -0,0 +1,${lines.length} @@`,
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: lines.length,
        lines: lines.map((content, index) => ({
          type: 'addition',
          oldLineNumber: null,
          newLineNumber: index + 1,
          content,
        })),
      },
    ],
  });
}

const source: DiffSource = { type: 'directory', sourcePath: '/reviewed' };
const adapter = {} as ReviewAdapter;

type ConfigContextValue = ReturnType<typeof useConfig>;

interface Handles {
  review: ReviewContextValue | null;
  config: ConfigContextValue | null;
}

function Capture({ handles }: { handles: Handles }) {
  const review = useReview();
  const config = useConfig();
  useEffect(() => {
    handles.review = review;
    handles.config = config;
  });
  return null;
}

function renderMarkdownReview(markdown: DiffFile, others: DiffFile[]) {
  const handles: Handles = { review: null, config: null };
  const view = render(
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider>
        <ReviewProvider initialFiles={[markdown, ...others]} initialSource={source}>
          <Capture handles={handles} />
          <FileSection file={markdown} viewMode='unified' expanded={true} />
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
  return { view, handles };
}

describe('RenderedMarkdownView comment drafts', () => {
  beforeEach(() => {
    installBrowserApiStubs();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps an unsaved draft through unrelated review and config updates', async () => {
    const markdown = makeAddedMarkdown('notes.md', ['# Title', '', 'Hello world']);
    const other = makeFile('other.txt');
    const { view, handles } = renderMarkdownReview(markdown, [other]);

    const paragraph = view.getByText('Hello world').closest('p');
    const gutter = paragraph?.querySelector('.rendered-gutter');
    expect(gutter).not.toBeNull();
    fireEvent.mouseDown(gutter as Element);

    const area = (await view.findByPlaceholderText(DRAFT_PLACEHOLDER)) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'unsaved draft' } });
    expect(area.value).toBe('unsaved draft');

    act(() => handles.review?.toggleViewed('other.txt'));
    act(() => handles.review?.addComment('other.txt', null, 'elsewhere', 'bug', null));
    act(() => handles.config?.updateConfig({ theme: 'dark' }));

    const after = view.getByPlaceholderText(DRAFT_PLACEHOLDER) as HTMLTextAreaElement;
    expect(after).toBe(area);
    expect(after.value).toBe('unsaved draft');
  });
});
