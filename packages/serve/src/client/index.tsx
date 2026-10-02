// The browser mount point for serve mode.
//
// The compiled stylesheet is imported explicitly because the package lists it
// under `sideEffects`; without this import the UI renders unstyled.
// The capability is taken from the launch URL once, before React mounts, then erased from the address bar.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ImportDiagnosticsBanner, ReviewPanel, Toolbar, useConfig } from '@self-review/react';
import type { ReviewPanelHandle } from '@self-review/react';
import type { AppConfig, OutputPathInfo } from '@self-review/core';
import '@self-review/react/styles.css';
import { createFetchAdapter, loadServeConfig, ServeRequestError } from './adapter';
import { REVIEW_TOO_LARGE_CODE, parseCapabilityFragment } from '../protocol';

// Removed with `history.replaceState`, so it leaves the history entry too. Null after a reload or a retyped address.
export function takeCapabilityFromLocation(): string | null {
  const capability = parseCapabilityFragment(window.location.hash);
  if (window.location.hash !== '') {
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search
    );
  }
  return capability;
}

// `failed` is `reviewing` with a notice: the close guard stays up and Finish Review resends.
type Status = 'reviewing' | 'submitting' | 'submitted' | 'failed';

interface SubmitFailure {
  code: string | null;
  message: string;
  details: readonly string[];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ConfigFailure {
  message: string;
  unauthorized: boolean;
}

function configFailureOf(error: unknown): ConfigFailure {
  return {
    message: messageOf(error),
    unauthorized: error instanceof ServeRequestError && error.status === 401,
  };
}

// Unrecoverable from the page: the only copy of the key was in the URL the server printed.
function CapabilityNotice() {
  return (
    <Notice title='Open the URL printed in the terminal'>
      <p data-testid='capability-notice'>
        This page needs the exact URL <code>self-review-serve</code> printed when it started. The
        part after <code>#</code> is this session&apos;s key, and a reloaded or retyped address does
        not have it.
      </p>
      <p>
        Copy the URL from the terminal again and open it in this tab. If the terminal is gone, or
        the server has been restarted since, stop it and start it again: a fresh URL is printed
        every time.
      </p>
    </Notice>
  );
}

function failureOf(error: unknown): SubmitFailure {
  if (error instanceof ServeRequestError) {
    return { code: error.code, message: error.message, details: error.details };
  }
  return { code: null, message: messageOf(error), details: [] };
}

/**
 * Push the server's output path into the config context.
 *
 * `ReviewPanel` owns its `ConfigProvider`, so the path arrives through the
 * context setter from inside the tree rather than as a prop. It makes the
 * file tree footer show where the review will be written — without a
 * "Change..." button, because the adapter has no `changeOutputPath`.
 */
function OutputPath({ info }: { info: OutputPathInfo | null }) {
  const { setOutputPathInfo } = useConfig();
  useEffect(() => {
    if (info) setOutputPathInfo(info);
  }, [info, setOutputPathInfo]);
  return null;
}

// The 200 follows the rename, so claiming a saved file is safe. The server stops after flushing it.
function Saved({ outputPath }: { outputPath: string | null }) {
  return (
    <Notice title='Review saved'>
      <p>
        The review was written to {outputPath ? <code>{outputPath}</code> : 'the output file'} and
        the server has stopped.
      </p>
      <p>
        You can close this tab. To keep reviewing, start the server again with{' '}
        <code>--resume-from</code>.
      </p>
    </Notice>
  );
}

// The size message already says what to do, so only filesystem refusals get the generic advice.
function SubmitFailureNotice({ failure }: { failure: SubmitFailure }) {
  const fixable = failure.code !== REVIEW_TOO_LARGE_CODE;
  return (
    <div
      role='alert'
      data-testid='submit-error'
      style={{
        padding: '0.5rem 0.75rem',
        background: '#7f1d1d',
        color: '#fff',
        fontSize: '0.8125rem',
        lineHeight: 1.4,
      }}
    >
      <div>
        <strong>The review was not saved{failure.code ? ` (${failure.code})` : ''}:</strong>{' '}
        {failure.message}
      </div>
      {failure.details.length > 0 && (
        <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
          {failure.details.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}
      {fixable && (
        <div style={{ marginTop: '0.25rem' }}>
          Your comments are still here. Fix the problem on the machine running the server, then
          press Finish Review again.
        </div>
      )}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '34rem', lineHeight: 1.5 }}>
        <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.75rem' }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

export interface AppProps {
  capability: string | null;
}

export function App({ capability }: AppProps) {
  // One adapter per page; none without a capability, since every request would be refused.
  const adapter = useMemo(
    () => (capability === null ? null : createFetchAdapter(capability)),
    [capability]
  );
  const reviewRef = useRef<ReviewPanelHandle>(null);

  const [config, setConfig] = useState<Partial<AppConfig> | null>(null);
  const [outputPathInfo, setOutputPathInfo] = useState<OutputPathInfo | null>(null);
  const [configError, setConfigError] = useState<ConfigFailure | null>(null);
  const [status, setStatus] = useState<Status>('reviewing');
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);

  // Config first: the providers below are seeded with it, so mounting before
  // it lands would render the wrong theme and categories.
  useEffect(() => {
    if (capability === null) return;
    let cancelled = false;
    loadServeConfig(capability)
      .then(loaded => {
        if (cancelled) return;
        setConfig(loaded?.config ?? {});
        setOutputPathInfo(loaded?.outputPathInfo ?? null);
      })
      .catch(error => {
        if (!cancelled) setConfigError(configFailureOf(error));
      });
    return () => {
      cancelled = true;
    };
  }, [capability]);

  // Warn before the tab closes with work that only exists in this page.
  //
  // The desktop application intercepts its window close and offers Save & Quit,
  // Discard or Cancel. A browser gives us less: `beforeunload` is a yes/no
  // prompt whose wording belongs to the browser, so this warns without being
  // able to offer the save. It is closer to the desktop than closing silently,
  // which is what happened before.
  //
  // Active until the review is on disk, including after a refused submission.
  useEffect(() => {
    if (!hasUnsavedWork || status === 'submitted') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedWork, status]);

  const handleFinishReview = useCallback(async () => {
    // One in flight at a time; none after an acknowledged one (the server stops). A refused one may be resent.
    if (status === 'submitting' || status === 'submitted' || adapter === null) return;
    const state = reviewRef.current?.getReviewState();
    if (!state) return;
    setStatus('submitting');
    setFailure(null);
    try {
      await adapter.submitReview?.(state);
      setStatus('submitted');
    } catch (error) {
      setFailure(failureOf(error));
      setStatus('failed');
    }
  }, [adapter, status]);

  // All hooks stay above this line: an early return ahead of an effect made React throw on the shorter hook list.

  // No key and a refused key get the same page: the fix is the printed URL either way.
  if (adapter === null || configError?.unauthorized) {
    return <CapabilityNotice />;
  }

  if (configError) {
    return (
      <Notice title='Could not reach the review server'>
        <p>{configError.message}</p>
        <p>The process that served this page may have exited.</p>
      </Notice>
    );
  }

  if (status === 'submitted') {
    return <Saved outputPath={outputPathInfo?.resolvedOutputPath ?? null} />;
  }

  if (!config) return null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {status === 'failed' && failure && <SubmitFailureNotice failure={failure} />}
      <ReviewPanel
        ref={reviewRef}
        adapter={adapter}
        config={config}
        onReviewChange={comments => setHasUnsavedWork(comments.length > 0)}
        className='flex-1 flex flex-col overflow-hidden bg-background text-foreground'
      >
        <OutputPath info={outputPathInfo} />
        <ImportDiagnosticsBanner />
        <Toolbar onFinishReview={() => void handleFinishReview()} />
      </ReviewPanel>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  // Taken before the first render; removing the key from the URL is this module's one side effect.
  createRoot(container).render(<App capability={takeCapabilityFromLocation()} />);
}
