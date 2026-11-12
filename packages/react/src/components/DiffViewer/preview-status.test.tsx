import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DiffFile, ImageLoadResult } from '@self-review/types';
import { LocalizationProvider } from '../../localization/LocalizationContext';
import RenderedImageView from './RenderedImageView';
import RenderedSvgView from './RenderedSvgView';

afterEach(cleanup);
const messages = {
  'Loading image...': 'Cargando imagen',
  'Image preview unavailable': 'Imagen no disponible',
  'Failed to load image.': 'No se pudo cargar la imagen',
  'Image loading not supported in this context.': 'Carga no disponible',
  'SVG preview unavailable': 'SVG no disponible',
  'SVG content could not be extracted.': 'Sin contenido SVG',
  'Failed to load SVG preview.': 'Error al cargar SVG',
};
const svg = (content?: string): DiffFile => ({
  oldPath: '',
  newPath: 'icon.svg',
  changeType: 'added',
  isBinary: false,
  hunks: content
    ? [
        {
          header: '@@ -0,0 +1 @@',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 1,
          lines: [{ type: 'addition', newLineNumber: 1, oldLineNumber: null, content }],
        },
      ]
    : [],
});

it('names the localized pending and error announcements while preserving host diagnostics', async () => {
  let resolve!: (value: ImageLoadResult) => void;
  const load = () =>
    new Promise<ImageLoadResult>(done => {
      resolve = done;
    });
  render(
    <LocalizationProvider locale='es' messages={messages}>
      <RenderedImageView filePath='photo.png' onLoadImage={load} />
    </LocalizationProvider>
  );
  expect(screen.getByRole('status', { name: 'Cargando imagen' })).toBeTruthy();
  await act(async () => resolve({ error: 'Host size limit: 10 MB' }));
  const alert = screen.getByRole('alert', { name: 'Imagen no disponible' });
  expect(alert.textContent).toContain('No se pudo cargar la imagen');
  expect(alert.textContent).toContain('Host size limit: 10 MB');
  expect(screen.queryByRole('status')).toBeNull();
});

it('localizes unsupported image loading and preserves rejected failure detail', async () => {
  const view = render(
    <LocalizationProvider messages={messages}>
      <RenderedImageView filePath='photo.png' />
    </LocalizationProvider>
  );
  expect(screen.getByRole('alert', { name: 'Imagen no disponible' }).textContent).toContain(
    'Carga no disponible'
  );
  view.rerender(
    <LocalizationProvider messages={messages}>
      <RenderedImageView
        filePath='photo.png'
        onLoadImage={async () => {
          throw new Error('permission denied');
        }}
      />
    </LocalizationProvider>
  );
  expect(await screen.findByText('permission denied')).toBeTruthy();
});

it('refuses a null image result and ignores an obsolete rejection', async () => {
  let reject!: (reason: Error) => void;
  const obsolete = () =>
    new Promise<ImageLoadResult>((_, fail) => {
      reject = fail;
    });
  const view = render(<RenderedImageView filePath='old.png' onLoadImage={obsolete} />);
  view.rerender(
    <RenderedImageView
      filePath='new.png'
      onLoadImage={async () => null as unknown as ImageLoadResult}
    />
  );
  expect(await screen.findByRole('alert', { name: 'Image preview unavailable' })).toBeTruthy();
  view.rerender(
    <RenderedImageView
      filePath='valid.png'
      onLoadImage={async () => ({ dataUri: 'data:image/png;base64,AA==', width: 1, height: 1 })}
    />
  );
  expect(await screen.findByAltText('valid.png')).toBeTruthy();
  await act(async () => reject(new Error('obsolete detail')));
  expect(screen.queryByText('obsolete detail')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.error(screen.getByAltText('valid.png'));
  expect(screen.getByRole('alert', { name: 'Image preview unavailable' })).toBeTruthy();
});

it('localizes SVG extraction and decode failures while retaining passive images and path identity', () => {
  const view = render(
    <LocalizationProvider messages={messages}>
      <RenderedSvgView file={svg()} />
    </LocalizationProvider>
  );
  expect(screen.getByRole('alert', { name: 'SVG no disponible' }).textContent).toBe(
    'Sin contenido SVG'
  );
  view.rerender(
    <LocalizationProvider messages={messages}>
      <RenderedSvgView file={svg('<svg xmlns="http://www.w3.org/2000/svg"/>')} />
    </LocalizationProvider>
  );
  const image = screen.getByAltText('icon.svg');
  expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
  fireEvent.error(image);
  expect(screen.getByRole('alert', { name: 'SVG no disponible' }).textContent).toBe(
    'Error al cargar SVG'
  );
});
