// The browser mount point for serve mode.
//
// The compiled stylesheet is imported explicitly because the package lists it
// under `sideEffects`; without this import the UI renders unstyled.
// The capability is taken from the launch URL once, before React mounts, then erased from the address bar.

import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button,
  ImportDiagnosticsBanner,
  ReviewPanel,
  Toolbar,
  useConfig,
  useReview,
  useReviewDraftWork,
  useReviewDraftGuard,
} from '@self-review/react';
import type { ReviewPanelHandle } from '@self-review/react';
import type { OutputPathInfo } from '@self-review/core';
import '@self-review/react/styles.css';
import { useServeConnection } from './useServeConnection';
import { SubmissionSession, useReviewSubmission, type SubmitFailure } from './useReviewSubmission';
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

/** Observe persisted state without changing the library's comments-only callback. */
function UnsavedWork({ onChange }: { onChange: () => void }) {
  const { files } = useReview();
  const drafts = useReviewDraftWork();
  const hasDraftWork = useReviewDraftGuard();
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (hasDraftWork()) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraftWork]);
  const previous = useRef(files);
  useEffect(() => {
    const before = previous.current;
    previous.current = files;
    if (
      drafts ||
      files.some(file => file.viewed || file.comments.length > 0) ||
      before.some(file => {
        const next = files.find(candidate => candidate.path === file.path);
        return next && (next.viewed !== file.viewed || next.comments !== file.comments);
      })
    )
      onChange();
  }, [files, drafts, onChange]);
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
  const fixable = !failure.uncertain && failure.code !== REVIEW_TOO_LARGE_CODE;
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
        <strong>
          {failure.uncertain ? 'The save outcome is unknown' : 'The review was not saved'}
          {failure.code ? ` (${failure.code})` : ''}:
        </strong>{' '}
        {failure.message}
      </div>
      {failure.details.length > 0 && (
        <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
          {failure.details.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}
      {failure.uncertain && (
        <div>
          Your comments are still here. Check the terminal and the output file on the server. Stop
          the original process before restarting with --resume-from if the file was saved. If it was
          not saved and the original server is still running, you can allow a retry below. Keep this
          page open to preserve unsaved comments. No submission is retried automatically.
        </div>
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

export function App(props: AppProps) {
  return <ReviewApp key={props.capability} {...props} />;
}

function ReviewApp({ capability }: AppProps) {
  const { connection, error: configError } = useServeConnection(capability);
  const adapter = connection?.adapter ?? null;
  const config = connection?.config ?? null;
  const outputPathInfo = connection?.outputPathInfo ?? null;
  const reviewRef = useRef<ReviewPanelHandle>(null);
  const { status, failure, finish, allowRetry, markUnsaved, sessionChanged } = useReviewSubmission(
    reviewRef,
    adapter
  );

  // All hooks stay above this line: an early return ahead of an effect made React throw on the shorter hook list.

  // No key and a refused key get the same page: the fix is the printed URL either way.
  if (capability === null || configError?.unauthorized) {
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

  if (!config || !adapter) return null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {(status === 'failed' || status === 'uncertain') && failure && (
        <SubmitFailureNotice failure={failure} />
      )}
      {status === 'uncertain' && (
        <div className='p-2' data-save-recovery>
          <Button variant='outline' onClick={allowRetry}>
            Allow retry after checking output
          </Button>
        </div>
      )}
      <div
        inert={status === 'submitting' || status === 'uncertain'}
        aria-busy={status === 'submitting'}
        data-testid='review-interaction'
        style={{ flex: 1, display: 'flex', minHeight: 0 }}
      >
        <ReviewPanel
          ref={reviewRef}
          adapter={adapter}
          config={config}
          className='flex-1 flex flex-col overflow-hidden bg-background text-foreground'
        >
          <SubmissionSession onChange={sessionChanged} />
          <UnsavedWork onChange={markUnsaved} />
          <OutputPath info={outputPathInfo} />
          <ImportDiagnosticsBanner />
          <Toolbar onFinishReview={status === 'uncertain' ? undefined : () => void finish()} />
        </ReviewPanel>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  // Taken before the first render; removing the key from the URL is this module's one side effect.
  createRoot(container).render(<App capability={takeCapabilityFromLocation()} />);
}
