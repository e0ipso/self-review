// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider, ReviewProvider, ReviewAdapterProvider } from '@self-review/react';
import SuggestionApplyControl from '../../../react/src/components/Comments/SuggestionApplyControl';
import { installBrowserApiStubs } from '../../../react/src/test-helpers';
import { createFetchAdapter } from './adapter';

installBrowserApiStubs();
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([
  {},
  { status: 'applied', filePath: 'another', replacedLines: 1 },
  { status: 'refused', filePath: 'a', reason: 3, detail: 'bad' },
])('keeps UI inspection protection after malformed 2xx Apply %j across collapse', async body => {
  const transport = vi.fn(
    async (path: string) =>
      new Response(
        JSON.stringify(path === '/api/resume' ? { comments: [], viewedFiles: [] } : body)
      )
  );
  vi.stubGlobal('fetch', transport);
  const adapter = createFetchAdapter('key');
  const source = { type: 'directory' as const, sourcePath: '/review' };
  const files = [
    { oldPath: 'a', newPath: 'a', changeType: 'modified' as const, hunks: [], isBinary: false },
  ];
  function Host({ open }: { open: boolean }) {
    return (
      <ReviewAdapterProvider adapter={adapter}>
        <ConfigProvider>
          <ReviewProvider initialSource={source} initialFiles={files}>
            {open && (
              <SuggestionApplyControl
                filePath='a'
                lineRange={{ side: 'new', start: 1, end: 1 }}
                suggestion={{ originalCode: 'a', proposedCode: 'b' }}
              />
            )}
          </ReviewProvider>
        </ConfigProvider>
      </ReviewAdapterProvider>
    );
  }
  const view = render(<Host open />);
  fireEvent.click(screen.getByTestId('suggestion-apply-button'));
  await waitFor(() =>
    expect(screen.getByTestId('suggestion-apply-outcome').getAttribute('data-status')).toBe(
      'unknown'
    )
  );
  view.rerender(<Host open={false} />);
  view.rerender(<Host open />);
  expect(screen.getByTestId('suggestion-apply-outcome').getAttribute('data-status')).toBe(
    'unknown'
  );
  expect(screen.queryByTestId('suggestion-apply-button')).toBeNull();
  const retry = screen.getByRole('button', { name: 'Allow a separate retry' });
  expect(retry.hasAttribute('disabled')).toBe(true);
  fireEvent.click(retry);
  expect(transport.mock.calls.filter(([path]) => path === '/api/apply-suggestion')).toHaveLength(1);
  adapter.dispose();
});
