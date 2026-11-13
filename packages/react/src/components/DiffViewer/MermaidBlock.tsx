import { useState, useEffect, useId } from 'react';
import { useLocalization } from '../../localization/LocalizationContext';
import { Button } from '../ui/button';
import { exceedsMermaidComplexity } from '../../services/mermaid-budget';
import { useResolvedTheme } from '../../context/ConfigContext';
import { svgToDataUri } from '../../utils/svg-data-uri';

import { useDiagramRenderer } from '../../context/PreviewRenderingContext';
import {
  DiagramImageError,
  MERMAID_MAX_SOURCE_CHARS,
  MERMAID_RENDER_TIMEOUT_MS,
} from '../../services/diagram-service';
// Preserve existing imports from this component.
export {
  MERMAID_MAX_SOURCE_CHARS,
  MERMAID_RENDER_TIMEOUT_MS,
  MERMAID_SECURE_KEYS,
  MERMAID_MAX_ADMITTED_RENDERS,
} from '../../services/diagram-service';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

interface DiagramImage {
  src: string;
  width: number | undefined;
  height: number | undefined;
  title: string | undefined;
  description: string | undefined;
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
  // Read only bounded text from the inert XML document. No SVG nodes enter the live DOM.
  const metadata = (name: string, limit: number) =>
    Array.from(root.children)
      .find(child => child.namespaceURI === SVG_NAMESPACE && child.localName === name)
      ?.textContent?.trim()
      .slice(0, limit) || undefined;
  return {
    title: metadata('title', 1000),
    description: metadata('desc', 4000),
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
  const resolvedTheme = useResolvedTheme();
  const descriptionId = useId();
  const diagramRenderer = useDiagramRenderer();
  const { t } = useLocalization();

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
    Promise.resolve()
      .then(() =>
        diagramRenderer.render({
          source: code,
          theme: resolvedTheme,
          signal: abort.signal,
        })
      )
      .then(({ svg }) => settle({ status: 'rendered', image: toDiagramImage(svg) }))
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
  }, [code, resolvedTheme, attempt, t, diagramRenderer]);

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
    <figure className='mermaid-block max-w-full rounded-lg border border-border bg-white dark:bg-muted/20 p-4'>
      <div className='flex justify-center overflow-x-auto'>
        <img
          src={state.image.src}
          alt={state.image.title ?? t('Mermaid diagram')}
          aria-describedby={state.image.description ? descriptionId : undefined}
          width={state.image.width}
          height={state.image.height}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>
      <figcaption className='mt-2 text-sm'>
        {state.image.description && <p id={descriptionId}>{state.image.description}</p>}
        <details>
          <summary>{t('Diagram source')}</summary>
          <pre className='overflow-auto whitespace-pre-wrap'>{code}</pre>
        </details>
      </figcaption>
    </figure>
  );
}
