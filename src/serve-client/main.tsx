// src/serve-client/main.tsx
// The serve-mode browser client.
//
// The counterpart of `src/renderer/App.tsx`: same library, same startup order —
// resolve the configuration, then mount the providers — with `fetch` where that
// one has `window.electronAPI`. Nothing visual is defined here. Everything the
// reviewer sees comes from `@self-review/react`; this file supplies only the
// mount point, the adapters and the chrome the package deliberately does not
// own (the finish control, and what to say once the review has been written).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewPanel, Toolbar, useConfig } from '../../packages/react/src/index';
import type { ReviewPanelHandle } from '../../packages/react/src/index';
import type { AppConfig, OutputPathInfo } from '../shared/types';
import { httpAdapter } from './adapter';
import { loadServeConfig } from './config-adapter';
import { finishReview, type FinishStatus } from './finish';
import lightThemeCss from 'prismjs/themes/prism.css?raw';
import darkThemeCss from 'prism-themes/themes/prism-one-dark.css?raw';
import './styles.css';

/**
 * Push the session's resolved output path into the package's config context.
 *
 * `ReviewPanel` takes no `initialOutputPath` — only `ConfigProvider` does, and
 * the panel owns that provider — so the path is set from inside the tree.
 * Children of `ReviewPanel` render within every provider, which is what makes
 * this possible without composing the providers by hand as the desktop app
 * does.
 *
 * Serve mode never changes the path after startup: the server resolved it
 * before it began listening, so this fires once and never again.
 */
function OutputPathBridge({ info }: { info?: OutputPathInfo }): null {
  const { setOutputPathInfo } = useConfig();

  useEffect(() => {
    if (info) setOutputPathInfo(info);
  }, [info, setOutputPathInfo]);

  return null;
}

/** A full-window message, used for both startup failure and a finished review. */
function Notice({ title, body, tone }: { title: string; body: string; tone: 'ok' | 'error' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        color: tone === 'error' ? '#b91c1c' : '#111827',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>{title}</h1>
      <p style={{ margin: 0, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
        {body}
      </p>
    </div>
  );
}

function App({ config, outputPathInfo }: { config: AppConfig; outputPathInfo?: OutputPathInfo }) {
  const reviewRef = useRef<ReviewPanelHandle>(null);
  const [status, setStatus] = useState<FinishStatus>({ kind: 'idle' });

  const handleFinishReview = useCallback(() => {
    // A second click while the first request is in flight would submit the
    // review twice, and the server stops the session on the first one.
    if (status.kind === 'saving' || status.kind === 'saved') return;
    setStatus({ kind: 'saving' });
    void finishReview(reviewRef.current, httpAdapter).then(setStatus);
  }, [status.kind]);

  // The server writes the review, answers, and stops. There is no window for
  // the browser to close, so the tab says what happened instead — and says it
  // in place of the panel, because the session it was editing is over.
  if (status.kind === 'saved') {
    return (
      <Notice
        tone='ok'
        title='Review saved'
        body={
          outputPathInfo?.resolvedOutputPath
            ? `Written to ${outputPathInfo.resolvedOutputPath}. The server has stopped; you can close this tab.`
            : 'The server has stopped; you can close this tab.'
        }
      />
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ReviewPanel
        ref={reviewRef}
        adapter={httpAdapter}
        config={config}
        prismLightCss={lightThemeCss}
        prismDarkCss={darkThemeCss}
        className='flex-1 flex flex-col overflow-hidden bg-background text-foreground'
      >
        <OutputPathBridge info={outputPathInfo} />
        {status.kind === 'error' && (
          <div
            role='alert'
            className='px-3 py-2 text-sm bg-destructive/10 text-destructive border-b border-destructive/30'
          >
            {status.message}
          </div>
        )}
        <Toolbar onFinishReview={handleFinishReview} />
      </ReviewPanel>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);

// Configuration first, mount second — the same order `src/renderer/App.tsx`
// keeps, and for the same reason: the categories, the theme and the resolved
// output path all arrive with it, and a panel mounted on library defaults would
// misreport where the review is going to be written.
loadServeConfig().then(
  ({ config, outputPathInfo }) => {
    root.render(<App config={config} outputPathInfo={outputPathInfo} />);
  },
  (error: unknown) => {
    root.render(
      <Notice
        tone='error'
        title='Could not load the review session'
        body={error instanceof Error ? error.message : String(error)}
      />
    );
  }
);
