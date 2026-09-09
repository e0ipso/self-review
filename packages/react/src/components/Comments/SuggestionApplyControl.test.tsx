import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  DiffFile,
  DiffLoadPayload,
  LineRange,
  Suggestion,
  SuggestionApplyOutcome,
} from '@self-review/types';

import { installBrowserApiStubs } from '../../test-helpers';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider } from '../../context/ReviewContext';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import type { ReviewAdapter } from '../../adapter';
import SuggestionApplyControl from './SuggestionApplyControl';

installBrowserApiStubs();

const FILE_PATH = 'src/auth/login.ts';
const LINE_RANGE: LineRange = { side: 'new', start: 5, end: 5 };
const SUGGESTION: Suggestion = { originalCode: 'const a = 1;', proposedCode: 'const a = 2;' };

function diffFile(path: string): DiffFile {
  return { oldPath: path, newPath: path, changeType: 'modified', isBinary: false, hunks: [] };
}

/** A diff payload whose remote provenance the control branches on. */
function remotePayload(temporaryClone: boolean): DiffLoadPayload {
  return {
    files: [diffFile(FILE_PATH)],
    source: { type: 'git', gitDiffArgs: '', repository: '/clone' },
    remote: {
      remoteUrl: 'https://github.com/o/r/pull/1',
      remoteBaseSha: 'aaa',
      remoteHeadSha: 'bbb',
      remoteForge: 'github',
      threadSyncAvailable: true,
      temporaryClone,
    },
  };
}

/**
 * Mount the control alone under an adapter. Nothing supplies a review
 * context here, which is what a host with no remote session looks like.
 */
function renderControl(adapter: ReviewAdapter) {
  return render(
    <ReviewAdapterProvider adapter={adapter}>
      <SuggestionApplyControl filePath={FILE_PATH} lineRange={LINE_RANGE} suggestion={SUGGESTION} />
    </ReviewAdapterProvider>
  );
}

/** Mount the control inside a real review session, so `remote` is populated. */
function renderInSession(adapter: ReviewAdapter) {
  return render(
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider initialConfig={{}}>
        <ReviewProvider>
          <SuggestionApplyControl
            filePath={FILE_PATH}
            lineRange={LINE_RANGE}
            suggestion={SUGGESTION}
          />
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}

const noopAdapter: ReviewAdapter = { loadDiff: async () => remotePayload(false) };

describe('SuggestionApplyControl', () => {
  it('renders nothing when the host cannot apply', () => {
    renderControl(noopAdapter);

    // No control at all, rather than a disabled one. A host with nowhere to
    // write offers nothing to click (PRD Section 5.4.8).
    expect(screen.queryByTestId('suggestion-apply')).toBeNull();
  });

  it('renders the control when the host can apply', () => {
    renderControl({ ...noopAdapter, applySuggestion: vi.fn() });

    expect(screen.getByTestId('suggestion-apply')).toBeTruthy();
    expect(screen.getByTestId('suggestion-apply-button').textContent).toContain('Apply');
  });

  it('reports an applied outcome and retires the button', async () => {
    const applySuggestion = vi.fn(
      async (): Promise<SuggestionApplyOutcome> => ({
        status: 'applied',
        filePath: FILE_PATH,
        replacedLines: 1,
      })
    );
    renderControl({ ...noopAdapter, applySuggestion });

    fireEvent.click(screen.getByTestId('suggestion-apply-button'));

    const outcome = await screen.findByTestId('suggestion-apply-outcome');
    expect(outcome.getAttribute('data-status')).toBe('applied');
    expect(outcome.textContent).toBe(`Applied to ${FILE_PATH}. Replaced 1 line.`);
    expect(applySuggestion).toHaveBeenCalledWith({
      filePath: FILE_PATH,
      lineRange: LINE_RANGE,
      suggestion: SUGGESTION,
    });
    // The matched lines are no longer on disk, so there is nothing to press
    // again.
    expect(screen.queryByTestId('suggestion-apply-button')).toBeNull();
  });

  it('reports a refusal with its reason and keeps the button', async () => {
    renderControl({
      ...noopAdapter,
      applySuggestion: async () => ({
        status: 'refused',
        filePath: FILE_PATH,
        reason: 'context-mismatch',
        detail: 'Those lines no longer match the code this suggestion was written against.',
      }),
    });

    fireEvent.click(screen.getByTestId('suggestion-apply-button'));

    const outcome = await screen.findByTestId('suggestion-apply-outcome');
    expect(outcome.getAttribute('data-status')).toBe('refused');
    expect(outcome.getAttribute('data-reason')).toBe('context-mismatch');
    expect(outcome.textContent).toContain('Not applied. Those lines no longer match');
    // A refusal is recoverable. Fix the file, press it again.
    expect(screen.getByTestId('suggestion-apply-button')).toBeTruthy();
  });

  it('reports a host that throws as a refusal, leaking nothing', async () => {
    renderControl({
      ...noopAdapter,
      applySuggestion: async () => {
        throw new Error('EACCES: /home/someone/.ssh/id_rsa');
      },
    });

    fireEvent.click(screen.getByTestId('suggestion-apply-button'));

    const outcome = await screen.findByTestId('suggestion-apply-outcome');
    expect(outcome.getAttribute('data-status')).toBe('refused');
    expect(outcome.getAttribute('data-reason')).toBe('host-unavailable');
    expect(outcome.textContent).toBe('Not applied. The apply request could not be completed.');
    expect(outcome.textContent).not.toContain('EACCES');
  });

  it('asks for a destination after the host refuses for want of one, then applies', async () => {
    const applySuggestion = vi
      .fn<() => Promise<SuggestionApplyOutcome>>()
      .mockResolvedValueOnce({
        status: 'refused',
        filePath: FILE_PATH,
        reason: 'destination-required',
        detail: 'Choose a destination directory to apply into.',
      })
      .mockResolvedValueOnce({ status: 'applied', filePath: FILE_PATH, replacedLines: 2 });
    const chooseApplyDestination = vi.fn(async () => ({
      status: 'chosen' as const,
      destinationRoot: '/work/repo',
    }));
    renderControl({ ...noopAdapter, applySuggestion, chooseApplyDestination });

    fireEvent.click(screen.getByTestId('suggestion-apply-button'));

    // The refusal flips the same control into asking for somewhere to write.
    const chooseButton = await screen.findByTestId('suggestion-apply-choose-destination');
    expect(chooseButton.textContent).toContain('Choose destination');

    fireEvent.click(chooseButton);

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-apply-outcome').getAttribute('data-status')).toBe(
        'applied'
      );
    });
    expect(chooseApplyDestination).toHaveBeenCalledTimes(1);
    expect(applySuggestion).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('suggestion-apply-outcome').textContent).toBe(
      `Applied to ${FILE_PATH}. Replaced 2 lines.`
    );
  });

  it('asks for a destination up front in a temporary-clone session', async () => {
    const applySuggestion = vi.fn(
      async (): Promise<SuggestionApplyOutcome> => ({
        status: 'applied',
        filePath: FILE_PATH,
        replacedLines: 1,
      })
    );
    const chooseApplyDestination = vi.fn(async () => ({
      status: 'chosen' as const,
      destinationRoot: '/work/repo',
    }));
    renderInSession({
      loadDiff: async () => remotePayload(true),
      applySuggestion,
      chooseApplyDestination,
    });

    // No attempt has been made, and none should be. The clone is deleted when
    // the review ends, so the session says up front that it has nowhere to
    // write.
    const chooseButton = await screen.findByTestId('suggestion-apply-choose-destination');
    expect(screen.getByTestId('suggestion-apply').textContent).toContain(
      'cloned into a temporary directory'
    );
    expect(applySuggestion).not.toHaveBeenCalled();

    fireEvent.click(chooseButton);

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-apply-outcome').getAttribute('data-status')).toBe(
        'applied'
      );
    });
    expect(applySuggestion).toHaveBeenCalledTimes(1);
  });
});
