import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { DiffFile, DiffLoadPayload, ResumeLoadPayload } from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';
import { ConfigProvider } from './ConfigContext';
import { ReviewProvider, useReview } from './ReviewContext';
import { ReviewAdapterProvider } from './ReviewAdapterContext';
import type { ReviewAdapter } from '../adapter';

installBrowserApiStubs();

function diffFile(path: string): DiffFile {
  return {
    oldPath: path,
    newPath: path,
    changeType: 'modified',
    isBinary: false,
    hunks: [],
  };
}

const payload: DiffLoadPayload = {
  files: [diffFile('src/a.ts'), diffFile('src/b.ts')],
  source: { type: 'git', gitDiffArgs: '', repository: '/repo' },
};

/** Serialises the review state under test into assertable text. */
function StateProbe() {
  const { files } = useReview();
  return (
    <div data-testid='probe'>
      {files
        .map(f => `${f.path}:${f.viewed}:${f.comments.length}`)
        .join('|')}
    </div>
  );
}

function renderWithResume(resumed: ResumeLoadPayload) {
  const adapter: ReviewAdapter = {
    loadDiff: async () => payload,
    loadResumedReview: async () => resumed,
  };

  return render(
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider initialConfig={{}}>
        <ReviewProvider>
          <StateProbe />
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}

describe('ReviewProvider resume flow', () => {
  it('restores the viewed flag for files the prior review marked as done', async () => {
    renderWithResume({ comments: [], viewedFiles: ['src/a.ts'] });

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe(
        'src/a.ts:true:0|src/b.ts:false:0'
      );
    });
  });

  it('restores comments alongside viewed flags', async () => {
    renderWithResume({
      comments: [
        {
          id: 'c1',
          filePath: 'src/b.ts',
          lineRange: { side: 'new', start: 3, end: 3 },
          body: 'Prior comment',
          category: 'nit',
          suggestion: null,
        },
      ],
      viewedFiles: ['src/a.ts'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe(
        'src/a.ts:true:0|src/b.ts:false:1'
      );
    });
  });

  it('leaves every file unviewed when the payload omits viewedFiles', async () => {
    renderWithResume({ comments: [] });

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe(
        'src/a.ts:false:0|src/b.ts:false:0'
      );
    });
  });
});
