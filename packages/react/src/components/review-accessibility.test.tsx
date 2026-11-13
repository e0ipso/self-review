import React from 'react';
import { it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { ReviewPanel } from '../ReviewPanel';
import Toolbar from './Toolbar';
import { LocalizationProvider } from '../localization/LocalizationContext';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();
const file = {
  oldPath: 'a.md',
  newPath: 'a.md',
  changeType: 'added' as const,
  isBinary: false,
  hunks: [
    {
      header: '@@ -0,0 +1 @@',
      oldStart: 0,
      newStart: 1,
      oldLines: 0,
      newLines: 1,
      lines: [
        { type: 'addition' as const, oldLineNumber: null, newLineNumber: 1, content: '# Hello' },
      ],
    },
  ],
};
it.each(['ltr', 'rtl'] as const)(
  'has named controls, separate file actions and no structural axe violations in %s',
  async direction => {
    const adapter = {
      loadDiff: async () => ({
        files: [file],
        source: { type: 'directory' as const, sourcePath: '/a' },
      }),
    };
    const { container } = render(
      <LocalizationProvider direction={direction}>
        <ReviewPanel adapter={adapter}>
          <Toolbar />
        </ReviewPanel>
      </LocalizationProvider>
    );
    await screen.findByTestId('file-section-a.md');
    expect(container.querySelector('button button, button [role="button"]')).toBeNull();
    const viewed = screen.getByTestId('viewed-toggle-a.md');
    expect(viewed.getAttribute('aria-pressed')).toBe('false');
    expect(viewed.getAttribute('aria-label')).toContain('a.md');
    const header = screen.getByRole('button', { name: 'Collapse a.md' });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header);
    expect(screen.getByRole('button', { name: 'Expand a.md' }).getAttribute('aria-expanded')).toBe(
      'false'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand a.md' }));
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(
      results.violations.map(violation => ({
        id: violation.id,
        nodes: violation.nodes.map(node => node.html),
      }))
    ).toEqual([]);
    expect(
      within(screen.getByTestId('file-section-a.md')).getByRole('button', {
        name: 'Comment on line 1',
      })
    ).toBeTruthy();
  }
);
