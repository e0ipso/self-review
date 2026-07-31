import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();

import FileTree from './FileTree';
import { ConfigProvider, useConfig } from '../context/ConfigContext';
import { ReviewProvider } from '../context/ReviewContext';
import { DiffNavigationProvider } from '../context/DiffNavigationContext';

const file: DiffFile = {
  oldPath: 'src/foo.ts',
  newPath: 'src/foo.ts',
  changeType: 'modified',
  isBinary: false,
  hunks: [],
};

function ConfigProbe() {
  const { config } = useConfig();
  return <div data-testid='probe-diff-view'>{config.diffView}</div>;
}

function renderStandalone(initialDiffView: 'split' | 'unified' = 'split') {
  return render(
    <ConfigProvider initialConfig={{ diffView: initialDiffView }}>
      <ReviewProvider initialFiles={[file]}>
        <DiffNavigationProvider>
          <FileTree />
          <ConfigProbe />
        </DiffNavigationProvider>
      </ReviewProvider>
    </ConfigProvider>
  );
}

describe('FileTree view-mode toggle', () => {
  it('renders both view-mode toggle items in the file tree header', () => {
    renderStandalone();
    expect(screen.queryByTestId('view-mode-split')).not.toBeNull();
    expect(screen.queryByTestId('view-mode-unified')).not.toBeNull();
  });

  it('marks the split item as active when config.diffView is "split"', () => {
    renderStandalone('split');
    expect(screen.getByTestId('view-mode-split').hasAttribute('data-pressed')).toBe(true);
    expect(screen.getByTestId('view-mode-unified').hasAttribute('data-pressed')).toBe(false);
  });

  it('dispatches updateConfig({ diffView: "unified" }) when the unified item is clicked', () => {
    renderStandalone('split');
    expect(screen.getByTestId('probe-diff-view').textContent).toBe('split');
    fireEvent.click(screen.getByTestId('view-mode-unified'));
    expect(screen.getByTestId('probe-diff-view').textContent).toBe('unified');
  });
});
