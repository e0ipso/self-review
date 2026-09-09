// The browser mount point for serve mode.
//
// Chrome only: the review interface itself is `ReviewPanel` from
// `@self-review/react`, mounted with the fetch adapter next door. Nothing in
// this file reimplements any part of the review UI, and the closest model for
// its shape is `tests/webapp/main.tsx`, which mounts the same component in a
// real browser against a different transport.
//
// The compiled stylesheet is imported explicitly because the package lists it
// under `sideEffects`; without this import the UI renders unstyled.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewPanel, Toolbar, useConfig } from '@self-review/react';
import type { ReviewPanelHandle } from '@self-review/react';
import type { AppConfig, OutputPathInfo } from '@self-review/core';
import '@self-review/react/styles.css';
import { createFetchAdapter, loadServeConfig } from './adapter';

type Status = 'reviewing' | 'submitting' | 'submitted' | 'failed';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

/**
 * What the page says once a review has been submitted.
 *
 * Careful with the wording: a 200 from `POST /api/review` means the
 * submission was accepted, not that the file exists. The server serializes
 * and writes after the response has been flushed, then exits — so the
 * authoritative confirmation is the line it prints on stderr, and this screen
 * points at the terminal rather than claiming a saved file.
 */
function Submitted({ outputPath }: { outputPath: string | null }) {
  return (
    <Notice title='Review submitted'>
      <p>
        The server is writing{' '}
        {outputPath ? <code>{outputPath}</code> : 'the review file'} and then
        exits.
      </p>
      <p>
        Check the terminal it was started from for the confirmation — or for an
        error, if the review could not be written.
      </p>
    </Notice>
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

function App() {
  // One adapter for the page: it holds the single shared GET /api/diff.
  const adapter = useMemo(() => createFetchAdapter(), []);
  const reviewRef = useRef<ReviewPanelHandle>(null);

  const [config, setConfig] = useState<Partial<AppConfig> | null>(null);
  const [outputPathInfo, setOutputPathInfo] = useState<OutputPathInfo | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('reviewing');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Config first, like the desktop: the providers below are seeded with it,
  // so mounting before it lands would render the wrong theme and categories.
  useEffect(() => {
    let cancelled = false;
    loadServeConfig()
      .then(loaded => {
        if (cancelled) return;
        setConfig(loaded?.config ?? {});
        setOutputPathInfo(loaded?.outputPathInfo ?? null);
      })
      .catch(error => {
        if (!cancelled) setConfigError(messageOf(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFinishReview = useCallback(async () => {
    // One submission per page: the server writes the file and exits on the
    // first one, so a second click would race a closing socket.
    if (status !== 'reviewing') return;
    const state = reviewRef.current?.getReviewState();
    if (!state) return;
    setStatus('submitting');
    try {
      await adapter.submitReview?.(state);
      setStatus('submitted');
    } catch (error) {
      setSubmitError(messageOf(error));
      setStatus('failed');
    }
  }, [adapter, status]);

  if (configError) {
    return (
      <Notice title='Could not reach the review server'>
        <p>{configError}</p>
        <p>The process that served this page may have exited.</p>
      </Notice>
    );
  }

  if (status === 'submitted') {
    return <Submitted outputPath={outputPathInfo?.resolvedOutputPath ?? null} />;
  }

  if (!config) return null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {status === 'failed' && submitError && (
        <div
          role='alert'
          style={{
            padding: '0.5rem 0.75rem',
            background: '#7f1d1d',
            color: '#fff',
            fontSize: '0.8125rem',
          }}
        >
          The review was not accepted: {submitError}
        </div>
      )}
      <ReviewPanel
        ref={reviewRef}
        adapter={adapter}
        config={config}
        className='flex-1 flex flex-col overflow-hidden bg-background text-foreground'
      >
        <OutputPath info={outputPathInfo} />
        <Toolbar onFinishReview={() => void handleFinishReview()} />
      </ReviewPanel>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
