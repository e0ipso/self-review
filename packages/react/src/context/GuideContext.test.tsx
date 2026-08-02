import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DiffFile, GuideLoadPayload } from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();

import FileTree from '../components/FileTree';
import Toolbar from '../components/Toolbar';
import { ConfigProvider } from './ConfigContext';
import { ReviewProvider } from './ReviewContext';
import { DiffNavigationProvider } from './DiffNavigationContext';
import { GuideProvider } from './GuideContext';

function makeFile(path: string): DiffFile {
  return {
    oldPath: path,
    newPath: path,
    changeType: 'modified',
    isBinary: false,
    hunks: [],
  };
}

const files = [
  makeFile('README.md'),
  makeFile('src/auth/login.ts'),
  makeFile('src/config.ts'),
];

const guide: GuideLoadPayload = {
  overview: 'Start with the core change.',
  groups: [
    {
      name: 'Core change',
      rationale: 'Where the behavior changes',
      implicit: false,
      files: [
        { path: 'src/config.ts', description: 'adds the knobs' },
        { path: 'src/auth/login.ts', description: 'uses the knobs' },
      ],
    },
    {
      name: 'Everything else',
      implicit: true,
      files: [{ path: 'README.md' }],
    },
  ],
};

function renderWithGuide(guidePayload?: GuideLoadPayload) {
  return render(
    <ConfigProvider>
      <GuideProvider initialGuide={guidePayload}>
        <ReviewProvider initialFiles={files}>
          <DiffNavigationProvider>
            <Toolbar />
            <FileTree />
          </DiffNavigationProvider>
        </ReviewProvider>
      </GuideProvider>
    </ConfigProvider>
  );
}

function displayedFileOrder(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-testid="file-tree"] [data-file-path]'
    )
  ).map(el => el.getAttribute('data-file-path')!);
}

describe('Guided/Flat toggle', () => {
  it('hides the toggle when no guide is loaded', () => {
    renderWithGuide(undefined);
    expect(screen.queryByTestId('guide-mode-guided')).toBeNull();
    expect(screen.queryByTestId('guide-mode-flat')).toBeNull();
  });

  it('defaults to Guided when a guide is present: headers, rationale, and guide order', () => {
    renderWithGuide(guide);
    expect(screen.getByTestId('guide-mode-guided').hasAttribute('data-pressed')).toBe(true);
    expect(screen.queryByTestId('guide-group-Core change')).not.toBeNull();
    expect(screen.getByTestId('guide-group-Core change').textContent).toContain(
      'Where the behavior changes'
    );
    // Implicit group labeled with its payload name, rendered last.
    expect(screen.queryByTestId('guide-group-Everything else')).not.toBeNull();
    expect(displayedFileOrder()).toEqual([
      'src/config.ts',
      'src/auth/login.ts',
      'README.md',
    ]);
    // Per-file one-liner from the guide on the tree entry.
    expect(
      screen.getByTestId('guide-file-description-src/config.ts').textContent
    ).toBe('adds the knobs');
  });

  it('switching to Flat restores the flat order with no group headers or one-liners', () => {
    renderWithGuide(guide);
    fireEvent.click(screen.getByTestId('guide-mode-flat'));
    expect(screen.queryByTestId('guide-group-Core change')).toBeNull();
    expect(screen.queryByTestId('guide-group-Everything else')).toBeNull();
    expect(
      screen.queryByTestId('guide-file-description-src/config.ts')
    ).toBeNull();
    expect(displayedFileOrder()).toEqual([
      'README.md',
      'src/auth/login.ts',
      'src/config.ts',
    ]);
  });

  it('viewed state is keyed by path and survives mode switches', () => {
    renderWithGuide(guide);
    fireEvent.click(screen.getByTestId('viewed-toggle-src/config.ts'));
    // Switch to flat and back — the same path stays viewed.
    fireEvent.click(screen.getByTestId('guide-mode-flat'));
    fireEvent.click(screen.getByTestId('guide-mode-guided'));
    const toggle = screen.getByTestId('viewed-toggle-src/config.ts');
    // CircleCheck renders when viewed; CircleDashed otherwise.
    expect(toggle.innerHTML).toContain('circle-check');
  });

  it('search filters within groups and hides emptied groups', () => {
    renderWithGuide(guide);
    fireEvent.change(screen.getByTestId('file-search'), {
      target: { value: 'login' },
    });
    expect(displayedFileOrder()).toEqual(['src/auth/login.ts']);
    expect(screen.queryByTestId('guide-group-Core change')).not.toBeNull();
    expect(screen.queryByTestId('guide-group-Everything else')).toBeNull();
  });
});
