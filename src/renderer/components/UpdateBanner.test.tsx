import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import UpdateBanner from './UpdateBanner';
import type { VersionUpdateInfo } from '../../shared/types';

it('renders a late notification, opens its release, and unsubscribes on unmount', () => {
  let notify!: (info: VersionUpdateInfo) => void;
  const off = vi.fn();
  const api = {
    onVersionUpdate: vi.fn(callback => {
      notify = callback;
      return off;
    }),
    requestVersionUpdate: vi.fn(),
    openExternal: vi.fn(async () => {}),
  };
  const mounted = render(<UpdateBanner api={api} />);
  expect(api.requestVersionUpdate).toHaveBeenCalledOnce();
  const update = {
    latestVersion: '3.0.0',
    releaseUrl: 'https://github.com/e0ipso/self-review/releases',
  };
  act(() => notify(update));
  expect(screen.getByTestId('update-banner').textContent).toContain('v3.0.0');
  fireEvent.click(screen.getByRole('button', { name: 'View release' }));
  expect(api.openExternal).toHaveBeenCalledWith(update.releaseUrl);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByTestId('update-banner')).toBeNull();
  mounted.unmount();
  expect(off).toHaveBeenCalledOnce();
});
