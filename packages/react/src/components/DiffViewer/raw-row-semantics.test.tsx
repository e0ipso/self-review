import React from 'react';
import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';
import { SPANISH_REVIEW } from '../../../../../src/shared/spanish-review';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider } from '../../context/ReviewContext';
import { LocalizationProvider } from '../../localization/LocalizationContext';
import UnifiedView from './UnifiedView';
import SplitView from './SplitView';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();
const file: DiffFile = {
  oldPath: 'source.txt',
  newPath: 'source.txt',
  changeType: 'modified',
  isBinary: false,
  hunks: [
    {
      header: '@@ -1,2 +1,2 @@',
      oldStart: 1,
      newStart: 1,
      oldLines: 2,
      newLines: 2,
      lines: [
        { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'kept source' },
        { type: 'deletion', oldLineNumber: 2, newLineNumber: null, content: 'removed source' },
        { type: 'addition', oldLineNumber: null, newLineNumber: 2, content: 'added source' },
      ],
    },
  ],
};
it.each([UnifiedView, SplitView])(
  'announces localized row types without replacing or copying source',
  View => {
    const drag = vi.fn();
    const noop = vi.fn();
    const tree = (spanish = false) => (
      <LocalizationProvider
        locale={spanish ? 'es' : 'en'}
        messages={spanish ? SPANISH_REVIEW : undefined}
      >
        <ConfigProvider>
          <ReviewProvider initialFiles={[file]}>
            <View
              file={file}
              commentRange={null}
              dragState={null}
              onDragStart={drag}
              onCancelComment={noop}
              onCommentSaved={noop}
            />
          </ReviewProvider>
        </ConfigProvider>
      </LocalizationProvider>
    );
    const { container, rerender } = render(tree());
    const codes = [...container.querySelectorAll('code')];
    const original = codes.map(code => code.textContent);
    expect(screen.getAllByRole('img', { name: 'Unchanged line' })).toHaveLength(
      View === UnifiedView ? 1 : 2
    );
    expect(
      screen
        .getByRole('img', { name: 'Removed line' })
        .closest('[data-line-side]')
        ?.getAttribute('data-line-side')
    ).toBe('old');
    expect(
      screen
        .getByRole('img', { name: 'Added line' })
        .closest('[data-line-side]')
        ?.getAttribute('data-line-side')
    ).toBe('new');
    for (const marker of screen.getAllByRole('img')) {
      expect(marker.textContent).toBe('');
      expect(marker.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(marker.style.userSelect).toBe('none');
      expect(marker.hasAttribute('data-line-number')).toBe(false);
      expect(marker.closest('[data-line-type]')?.hasAttribute('aria-label')).toBe(false);
    }
    const selection = window.getSelection()!;
    for (const code of codes) {
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
      expect(selection.toString()).toBe(code.textContent);
      expect(code.hasAttribute('aria-label')).toBe(false);
      expect(code.hasAttribute('aria-hidden')).toBe(false);
    }
    selection.removeAllRanges();
    rerender(tree(true));
    expect(screen.getByRole('img', { name: 'Línea añadida' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Línea eliminada' })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: 'Línea sin cambios' })).toHaveLength(
      View === UnifiedView ? 1 : 2
    );
    expect([...container.querySelectorAll('code')]).toEqual(codes);
    expect(codes.map(code => code.textContent)).toEqual(original);
    const old = screen.getByRole('button', { name: 'Comentar línea anterior 2' });
    fireEvent.keyDown(old, { key: 'Enter' });
    expect(drag).toHaveBeenLastCalledWith(View === UnifiedView ? 1 : 2, 'old', true);
  }
);
