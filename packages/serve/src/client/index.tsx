// The browser mount point for serve mode.
//
// The compiled stylesheet is imported explicitly because the package lists it
// under `sideEffects`; without this import the UI renders unstyled.
//
// `App` is exported for its own suite, which mounts it against a real
// listener; the module mounts it into `#root` only when that element exists.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ImportDiagnosticsBanner, ReviewPanel, Toolbar, useConfig } from '@self-review/react';
import type { ReviewPanelHandle } from '@self-review/react';
import type { AppConfig, OutputPathInfo } from '@self-review/core';
import '@self-review/react/styles.css';
import { createFetchAdapter, loadServeConfig, ServeRequestError } from './adapter';
import { REVIEW_TOO_LARGE_CODE } from '../protocol';

/**
 * `failed` is a reviewing state with a notice: the review is still in the
 * page, the close guard is still up, and Finish Review sends it again.
 */
type Status = 'reviewing' | 'submitting' | 'submitted' | 'failed';

/** What the page shows for a refused submission: enough to fix it. */
interface SubmitFailure {
  code: string | null;
  message: string;
  details: readonly string[];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

/**
 * What the page says once the review is on disk.
 *
 * This can claim a saved file because `POST /api/review` publishes before it
 * answers: the 200 the adapter resolved on was sent after the rename that
 * put the document in place. The server stops itself once that response has
 * been flushed, which is why there is no second attempt from here.
 */
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

/**
 * A refused submission, above a review that is still entirely here.
 *
 * The message is the server's own, or the adapter's for a body it would not
 * send; the code names the publisher's refusal so a reader of the terminal
 * can match the two. The size message already says what to do, so only the
 * filesystem refusals get the generic advice.
 */
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

export function App() {
  // One adapter for the page: it holds the single shared GET /api/diff.
  const adapter = useMemo(() => createFetchAdapter(), []);
  const reviewRef = useRef<ReviewPanelHandle>(null);

  const [config, setConfig] = useState<Partial<AppConfig> | null>(null);
  const [outputPathInfo, setOutputPathInfo] = useState<OutputPathInfo | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('reviewing');
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);

  // Config first: the providers below are seeded with it, so mounting before
  // it lands would render the wrong theme and categories.
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

  // Warn before the tab closes with work that only exists in this page.
  //
  // The desktop application intercepts its window close and offers Save & Quit,
  // Discard or Cancel. A browser gives us less: `beforeunload` is a yes/no
  // prompt whose wording belongs to the browser, so this warns without being
  // able to offer the save. It is closer to the desktop than closing silently,
  // which is what happened before.
  //
  // Up until the review is on disk: while a submission is in flight, and
  // after one has been refused, the comments still live only here. The
  // listener stays up either way; nothing tells the process the reviewer left.
  useEffect(() => {
    if (!hasUnsavedWork || status === 'submitted') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedWork, status]);

  const handleFinishReview = useCallback(async () => {
    // One submission in flight at a time, and none after the one that was
    // acknowledged — the server stops on it. A refused one may be sent again.
    if (status === 'submitting' || status === 'submitted') return;
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

  // Every hook is above this line and every early return below it: the
  // config notice once rendered ahead of an effect, and React threw on the
  // shorter hook list instead of showing it.

  if (configError) {
    return (
      <Notice title='Could not reach the review server'>
        <p>{configError}</p>
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
  createRoot(container).render(<App />);
}
