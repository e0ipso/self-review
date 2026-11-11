import { useState, useEffect } from 'react';
import { useLocalization } from '../../localization/LocalizationContext';
import { Button } from '../ui/button';
import { exceedsMermaidComplexity, MERMAID_MAX_EDGES } from './mermaid-budget';
import { useAppearance } from '../../context/ConfigContext';
import { svgToDataUri } from '../../utils/svg-data-uri';

/** Longer diagram source is never handed to Mermaid; also pinned as its `maxTextSize`. */
export const MERMAID_MAX_SOURCE_CHARS = 50_000;

/** Layout is synchronous and cannot be interrupted; this only bounds the wait on a stall. */
export const MERMAID_RENDER_TIMEOUT_MS = 10_000;

/**
 * Keys reviewed content cannot change via `%%{init}%%` or front matter: Mermaid drops every
 * `secure` key from directives. The first six restate its defaults; the rest could inject
 * CSS or HTML, change text measurement, or weaken label sanitization.
 */
export const MERMAID_SECURE_KEYS: readonly string[] = [
  'secure',
  'securityLevel',
  'startOnLoad',
  'maxTextSize',
  'maxEdges',
  'suppressErrorRendering',
  'themeCSS',
  'fontFamily',
  'altFontFamily',
  'htmlLabels',
  'dompurifyConfig',
];

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

let mermaidIdCounter = 0;

function resolveIsDark(theme: 'light' | 'dark' | 'system'): boolean {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return theme === 'dark';
}

/** Renders in a hidden off-screen container (outside `.self-review`) removed on success or failure. */
let renderQueue: Promise<unknown> = Promise.resolve();
let admittedRenders = 0;
export const MERMAID_MAX_ADMITTED_RENDERS = 8;

/** Serial admission prevents overlapping global Mermaid configuration and layout jobs. */
function renderMermaidSvg(code: string, isDark: boolean, signal: AbortSignal): Promise<string> {
  if (admittedRenders >= MERMAID_MAX_ADMITTED_RENDERS)
    return Promise.reject(new DiagramImageError('busy'));
  admittedRenders++;
  const result = renderQueue
    .then(() => renderQueuedSvg(code, isDark, signal))
    .finally(() => {
      admittedRenders--;
    });
  // A stalled library job retains the slot. A wait timeout cannot safely release active layout.
  renderQueue = result.catch(() => {});
  return result;
}
async function renderQueuedSvg(
  code: string,
  isDark: boolean,
  signal: AbortSignal
): Promise<string> {
  signal.throwIfAborted();
  const mermaid = (await import('mermaid')).default;
  signal.throwIfAborted();

  // Re-initialize per render: current palette, and no directives carried over.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    secure: [...MERMAID_SECURE_KEYS],
    theme: isDark ? 'dark' : 'default',
    // SVG text instead of <foreignObject>, so the output renders identically through <img>.
    htmlLabels: false,
    maxTextSize: MERMAID_MAX_SOURCE_CHARS,
    maxEdges: MERMAID_MAX_EDGES,
    // Throw on a parse failure instead of drawing Mermaid's error diagram.
    suppressErrorRendering: true,
  });

  const sandbox = document.createElement('div');
  sandbox.setAttribute('data-mermaid-sandbox', '');
  sandbox.setAttribute('aria-hidden', 'true');
  sandbox.style.cssText =
    'position:fixed;top:0;left:-100000px;width:1024px;height:1px;overflow:hidden;' +
    'visibility:hidden;pointer-events:none;';
  document.body.appendChild(sandbox);
  const remove = () => sandbox.remove();
  signal.addEventListener('abort', remove, { once: true });
  try {
    // mermaid.render needs a unique ID per call.
    const { svg } = await mermaid.render(`mermaid-${mermaidIdCounter++}`, code, sandbox);
    signal.throwIfAborted();
    return svg;
  } finally {
    signal.removeEventListener('abort', remove);
    sandbox.remove();
  }
}

class DiagramImageError extends Error {
  constructor(readonly kind: 'svg' | 'size' | 'busy') {
    super(kind);
  }
}
interface DiagramImage {
  src: string;
  width: number | undefined;
  height: number | undefined;
}

/**
 * Parsed as XML first (scripting off) because `<img>` shows malformed SVG as a bare broken
 * image. The viewBox gives the image the intrinsic size a percentage-width SVG lacks.
 */
function toDiagramImage(svg: string): DiagramImage {
  if (svg.length > 1_000_000) throw new DiagramImageError('size');
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (
    !root ||
    doc.getElementsByTagName('parsererror').length > 0 ||
    root.namespaceURI !== SVG_NAMESPACE ||
    root.localName !== 'svg'
  ) {
    throw new DiagramImageError('svg');
  }

  const viewBox = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , width, height] = viewBox.length === 4 ? viewBox : [];
  const sized = width !== undefined && width > 0 && height !== undefined && height > 0;

  if (
    sized &&
    (!Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width > 16384 ||
      height > 16384 ||
      width * height > 64_000_000)
  )
    throw new DiagramImageError('size');
  return {
    src: svgToDataUri(svg),
    width: sized ? Math.ceil(width) : undefined,
    height: sized ? Math.ceil(height) : undefined,
  };
}

type BlockState =
  | { status: 'pending' }
  | { status: 'rendered'; image: DiagramImage }
  | { status: 'error'; message: string };

/**
 * Renders a ```mermaid fence through `<img>` and a `data:` URI, like `RenderedSvgView`, so
 * markup a diagram smuggles into its output cannot style or cover review controls.
 */
export default function MermaidBlock({ code }: { code: string }) {
  const [state, setState] = useState<BlockState>({ status: 'pending' });
  const [attempt, setAttempt] = useState(0);
  const config = useAppearance();
  const { t } = useLocalization();
  const isDark = resolveIsDark(config.theme);

  useEffect(() => {
    if (code.length > MERMAID_MAX_SOURCE_CHARS) {
      setState({
        status: 'error',
        message: t('Diagram source is too large ({count} characters; the limit is {limit})', {
          count: code.length,
          limit: MERMAID_MAX_SOURCE_CHARS,
        }),
      });
      return;
    }
    if (exceedsMermaidComplexity(code)) {
      setState({
        status: 'error',
        message: t('Diagram exceeds the layout complexity limits. Read the source below.'),
      });
      return;
    }
    let settled = false;
    const abort = new AbortController();
    const settle = (next: BlockState) => {
      if (settled) return;
      settled = true;
      setState(next);
    };
    setState({ status: 'pending' });
    // This timer bounds an asynchronous wait only. It cannot interrupt synchronous layout.
    const timer = window.setTimeout(() => {
      settle({
        status: 'error',
        message: t(
          'Rendering timed out after {seconds} seconds. Synchronous layout cannot be interrupted.',
          { seconds: MERMAID_RENDER_TIMEOUT_MS / 1000 }
        ),
      });
      abort.abort();
    }, MERMAID_RENDER_TIMEOUT_MS);
    renderMermaidSvg(code, isDark, abort.signal)
      .then(svg => settle({ status: 'rendered', image: toDiagramImage(svg) }))
      .catch((err: unknown) =>
        settle({
          status: 'error',
          message:
            err instanceof DiagramImageError
              ? t(
                  err.kind === 'svg'
                    ? 'The diagram did not render to a well-formed SVG image'
                    : err.kind === 'busy'
                      ? 'Too many diagrams are waiting. Retry after another diagram finishes.'
                      : 'Diagram output exceeds the image size limit.'
                )
              : t('Failed to render diagram. {detail}', {
                  detail: err instanceof Error ? err.message : String(err),
                }),
        })
      )
      .finally(() => window.clearTimeout(timer));
    return () => {
      settled = true;
      abort.abort();
      window.clearTimeout(timer);
    };
  }, [code, isDark, attempt, t]);

  if (state.status === 'error')
    return (
      <div data-testid='mermaid-error' className='text-sm p-2 border border-destructive/20 rounded'>
        <p role='alert' className='text-destructive'>
          {t('Mermaid error: {detail}', { detail: state.message })}
        </p>
        <Button variant='outline' size='sm' onClick={() => setAttempt(value => value + 1)}>
          {t('Retry')}
        </Button>
        <details open>
          <summary>{t('Diagram source')}</summary>
          <pre className='overflow-auto whitespace-pre-wrap'>{code}</pre>
        </details>
      </div>
    );
  if (state.status === 'pending')
    return (
      <div role='status' className='animate-pulse bg-muted p-2 h-32 rounded'>
        {t('Rendering diagram...')}
      </div>
    );
  return (
    <div className='mermaid-block flex justify-center overflow-x-auto max-w-full rounded-lg border border-border bg-white dark:bg-muted/20 p-4'>
      <img
        src={state.image.src}
        alt={t('Mermaid diagram')}
        width={state.image.width}
        height={state.image.height}
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
