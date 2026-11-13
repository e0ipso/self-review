import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { AttachmentImage } from './AttachmentImage';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import { LocalizationProvider } from '../../localization/LocalizationContext';
import { installBrowserApiStubs } from '../../test-helpers';
import { FileSectionHeader } from '../DiffViewer/FileSectionHeader';
installBrowserApiStubs();

it('names attachment activation and returns focus after Escape in RTL', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:image');
  URL.revokeObjectURL = vi.fn();
  const { container } = render(
    <LocalizationProvider direction='rtl' messages={{ 'Enlarge attachment': 'Open image' }}>
      <ConfigProvider>
        <AttachmentImage
          attachment={{
            id: 'a',
            fileName: 'a.png',
            mediaType: 'image/png',
            data: new ArrayBuffer(1),
          }}
        />
      </ConfigProvider>
    </LocalizationProvider>
  );
  const trigger = await screen.findByRole('button', { name: 'Open image' });
  expect(trigger.tagName).toBe('BUTTON');
  trigger.focus();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: 'Attachment' });
  expect(dialog.closest('.self-review')).toBeTruthy();
  expect(dialog.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
  // jsdom cannot measure contrast, zoom, image layout or a real decoder.
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(result.violations).toEqual([]);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it('reports clipboard capability failure and permits an explicit retry', async () => {
  const writeClipboard = vi
    .fn()
    .mockRejectedValueOnce(new Error('denied'))
    .mockResolvedValue(undefined);
  render(
    <ReviewAdapterProvider adapter={{ loadDiff: vi.fn(), writeClipboard }}>
      <ConfigProvider>
        <FileSectionHeader
          file={{ oldPath: 'a', newPath: 'a', changeType: 'added', isBinary: false, hunks: [] }}
          filePath='a'
          expanded={true}
          isViewed={false}
          isPreviewable={false}
          renderViewMode='raw'
          comments={[]}
          onToggle={vi.fn()}
          onViewedToggle={vi.fn()}
          onAddFileComment={vi.fn()}
          onRenderViewModeChange={vi.fn()}
        />
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Copy file path' }));
  expect((await screen.findByRole('alert')).textContent).toContain('could not be copied');
  fireEvent.click(screen.getByRole('button', { name: 'Copy file path' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(writeClipboard).toHaveBeenNthCalledWith(2, 'a');
});
