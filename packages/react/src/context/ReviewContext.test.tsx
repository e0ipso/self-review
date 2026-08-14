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
  const { files, diffFiles, diffSource } = useReview();
  return (
    <>
      <div data-testid='probe'>
        {files
          .map(f => `${f.path}:${f.viewed}:${f.comments.length}`)
          .join('|')}
      </div>
      <div data-testid='diff-probe'>
        {diffFiles.map(f => f.newPath || f.oldPath).join('|')}
      </div>
      <div data-testid='source-probe'>{diffSource.type}</div>
    </>
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

describe('ReviewProvider resume merge for paths absent from the diff', () => {
  it('retains review-level and missing-file comments as synthetic entries', async () => {
    renderWithResume({
      comments: [
        {
          id: 'r1',
          // Review-level sentinel path: the thread had no file anchor.
          filePath: '',
          lineRange: null,
          body: 'overall remark',
          category: '',
          suggestion: null,
          remoteId: 't2',
        },
        {
          id: 'r2',
          // Outdated anchor whose path is no longer in the diff.
          filePath: 'gone/old.ts',
          lineRange: null,
          body: 'stale thread',
          category: '',
          suggestion: null,
          remoteId: 't3',
        },
      ],
      viewedFiles: [],
    });

    await waitFor(() => {
      // Comments survive in review state (they must round-trip on save)…
      expect(screen.getByTestId('probe').textContent).toBe(
        'src/a.ts:false:0|src/b.ts:false:0|:false:1|gone/old.ts:false:1'
      );
      // …and synthetic diff entries exist so the UI can render them.
      expect(screen.getByTestId('diff-probe').textContent).toBe(
        'src/a.ts|src/b.ts||gone/old.ts'
      );
    });
  });
});

describe('ReviewProvider pushed diff payloads (welcome → remote URL open)', () => {
  it('transitions from the welcome payload to a later pushed diff', async () => {
    let pushDiff: ((p: DiffLoadPayload) => void) | null = null;
    const adapter: ReviewAdapter = {
      loadDiff: async () => ({
        files: [],
        source: { type: 'welcome' },
      }),
      onDiffLoad: cb => {
        pushDiff = cb;
        return () => {
          pushDiff = null;
        };
      },
    };

    render(
      <ReviewAdapterProvider adapter={adapter}>
        <ConfigProvider initialConfig={{}}>
          <ReviewProvider>
            <StateProbe />
          </ReviewProvider>
        </ConfigProvider>
      </ReviewAdapterProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('source-probe').textContent).toBe('welcome');
      expect(pushDiff).not.toBeNull();
    });

    // Main pushes the remote session's diff after materialization.
    pushDiff!(payload);

    await waitFor(() => {
      expect(screen.getByTestId('source-probe').textContent).toBe('git');
      expect(screen.getByTestId('diff-probe').textContent).toBe(
        'src/a.ts|src/b.ts'
      );
    });
  });
});
