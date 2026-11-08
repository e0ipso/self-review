import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';
import type { ReviewAdapter } from '../adapter';

import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();

// jsdom has no ResizeObserver, which react-resizable-panels needs.
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = NoopResizeObserver;

import { ReviewPanel } from '../ReviewPanel';

// Valid filenames that each break a naive `[data-file-path="${path}"]` selector.
const AWKWARD_PATHS = [
  'src/quote"name.ts',
  'src/back\\slash.ts',
  'src/bracket].ts',
  'src/new\nline.ts',
  'src/with space.ts',
];

function makeFile(filePath: string): DiffFile {
  return {
    oldPath: filePath,
    newPath: filePath,
    changeType: 'modified',
    isBinary: false,
    hunks: [
      {
        header: '@@ -1,1 +1,1 @@',
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [
          { type: 'deletion', oldLineNumber: 1, newLineNumber: null, content: 'old' },
          { type: 'addition', oldLineNumber: null, newLineNumber: 1, content: 'new' },
        ],
      },
    ],
  };
}

const adapter: ReviewAdapter = {
  loadDiff: async () => ({
    files: AWKWARD_PATHS.map(makeFile),
    source: { type: 'git', gitDiffArgs: '', repository: '/repo' },
  }),
};

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

async function renderPanel() {
  render(<ReviewPanel adapter={adapter} />);
  await screen.findByTestId(`file-section-${AWKWARD_PATHS[0]}`, { normalizer: text => text });
  // Flush the passive effect that seeds DiffViewer's expanded state before clicking headers.
  await act(async () => {});
}

// The default normalizer collapses whitespace, making the newline path unmatchable.
function byTestId(id: string): HTMLElement {
  return screen.getByTestId(id, { normalizer: text => text });
}

function section(filePath: string): HTMLElement {
  return byTestId(`file-section-${filePath}`);
}

function isExpanded(filePath: string): boolean {
  return section(filePath).querySelector('.file-diff-content') !== null;
}

describe('file navigation with filenames that are not CSS-selector safe', () => {
  it.each(AWKWARD_PATHS)('scrolls to the section for %j from the file tree', async filePath => {
    await renderPanel();

    fireEvent.click(byTestId(`file-entry-${filePath}`));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(section(filePath));
  });

  it.each(AWKWARD_PATHS)('collapses and re-expands the section for %j', async filePath => {
    await renderPanel();
    expect(isExpanded(filePath)).toBe(true);

    fireEvent.click(byTestId(`file-header-${filePath}`));
    expect(isExpanded(filePath)).toBe(false);

    fireEvent.click(byTestId(`file-header-${filePath}`));
    expect(isExpanded(filePath)).toBe(true);
  });

  it.each(AWKWARD_PATHS)(
    'marks %j viewed from the file tree, collapsing it from the effect path',
    async filePath => {
      await renderPanel();

      act(() => {
        fireEvent.click(byTestId(`viewed-toggle-${filePath}`));
      });

      expect(byTestId(`viewed-${filePath}`).textContent).toContain('Done reviewing');
      expect(isExpanded(filePath)).toBe(false);
      // The neighbours are untouched.
      for (const other of AWKWARD_PATHS.filter(p => p !== filePath)) {
        expect(isExpanded(other)).toBe(true);
      }
    }
  );

  it.each(AWKWARD_PATHS)('marks %j viewed from its section header', async filePath => {
    await renderPanel();

    fireEvent.click(byTestId(`viewed-${filePath}`));

    expect(byTestId(`viewed-${filePath}`).textContent).toContain('Done reviewing');
    expect(isExpanded(filePath)).toBe(false);
  });
});
