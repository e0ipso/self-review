import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { DiffFile } from '@self-review/types';
import { ReviewProviders } from '../../ReviewProviders';
import { useReviewCommands } from '../../context/ReviewContext';
import { installBrowserApiStubs } from '../../test-helpers';
import FileSection from './FileSection';
installBrowserApiStubs();
afterEach(cleanup);
const file: DiffFile = {
  oldPath: 'a.ts',
  newPath: 'a.ts',
  changeType: 'added',
  isBinary: false,
  hunks: [],
};
const files = [file];
const adapter = {
  loadDiff: async () => ({ files, source: { type: 'directory' as const, sourcePath: '/review' } }),
};
it.each([false, true])(
  'uses the same viewed/expansion transitions with controlled=%s',
  controlled => {
    function Section() {
      const [expanded, setExpanded] = useState(true);
      const { toggleViewed } = useReviewCommands();
      return (
        <>
          <button onClick={() => toggleViewed('a.ts')}>Tree viewed</button>
          <FileSection
            file={file}
            viewMode='unified'
            {...(controlled
              ? { expanded, onToggleExpanded: () => setExpanded(value => !value) }
              : {})}
          />
        </>
      );
    }
    render(
      <ReviewProviders adapter={adapter} initialFiles={files}>
        <Section />
      </ReviewProviders>
    );
    expect(screen.getByRole('button', { name: 'Collapse a.ts' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('viewed-a.ts'));
    expect(screen.getByRole('button', { name: 'Expand a.ts' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('viewed-a.ts'));
    expect(screen.getByRole('button', { name: 'Collapse a.ts' })).toBeTruthy();
    fireEvent.click(screen.getByText('Tree viewed'));
    expect(screen.getByRole('button', { name: 'Expand a.ts' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand a.ts' }));
    expect(screen.getByRole('button', { name: 'Collapse a.ts' })).toBeTruthy();
  }
);
