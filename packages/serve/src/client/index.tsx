// The browser mount point for serve mode.
//
// The compiled stylesheet is imported explicitly because the package lists it
// under `sideEffects`; without this import the UI renders unstyled.
//
// `App` is exported for its own suite, which mounts it against a real
// listener; the module mounts it into `#root` only when that element exists.
//
// The session capability arrives in the launch URL's fragment and is taken
// from there exactly once, before React mounts: it is handed to `App` as a
// prop, held in the adapter's closure, and erased from the address bar, so
// a reload, a bookmark or a copied address does not carry it.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ImportDiagnosticsBanner, ReviewPanel, Toolbar, useConfig } from '@self-review/react';
import type { ReviewPanelHandle } from '@self-review/react';
import type { AppConfig, OutputPathInfo } from '@self-review/core';
import '@self-review/react/styles.css';
import { createFetchAdapter, loadServeConfig, ServeRequestError } from './adapter';
import { REVIEW_TOO_LARGE_CODE, parseCapabilityFragment } from '../protocol';

/**
 * Take the session capability out of the page's URL.
 *
 * The fragment is read and then removed with `history.replaceState`, so the
 * token is gone from the address bar, from the history entry and from
 * anything that copies the URL — the only copy left is the one returned
 * here. Null when the page was opened without one: a reload, a retyped
 * address, a link without its fragment.
 */
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

/** What stopped the config request: the message, and whether it was a 401. */
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

/**
 * The page was opened without this session's key, or with one the server
 * does not recognise — a reloaded tab, a retyped address, a URL from an
 * earlier start. Nothing here can recover it: the only copy the server ever
 * gave out was in the URL it printed.
 */
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

export interface AppProps {
  /**
   * The session capability from the launch URL, or null when the page was
   * opened without one. Held in React state and the adapter's closure only.
   */
  capability: string | null;
}

export function App({ capability }: AppProps) {
  // One adapter for the page: it holds the single shared GET /api/diff and
  // the capability every request presents. None without a capability — a
  // request that is certain to be refused is not worth sending.
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

  // Every hook is above this line and every early return below it: the
  // config notice once rendered ahead of an effect, and React threw on the
  // shorter hook list instead of showing it.

  // No key, or a key the server refused: the same page either way, since
  // the fix is the same — the printed URL — and a refused key says no more.
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
  // Taken before the first render, and only here: the module's one side
  // effect on the document is removing the key from its URL.
  createRoot(container).render(<App capability={takeCapabilityFromLocation()} />);
}
