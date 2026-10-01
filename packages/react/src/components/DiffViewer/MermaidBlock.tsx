import { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { svgToDataUri } from '../../utils/svg-data-uri';

/**
 * Reviewed diagram source longer than this is not handed to Mermaid at all.
 * It is also Mermaid's own `maxTextSize`, pinned here so content cannot
 * raise it.
 */
export const MERMAID_MAX_SOURCE_CHARS = 50_000;

/**
 * How long the block waits for Mermaid before it shows an error instead.
 * Layout runs synchronously on the main thread, so this cannot interrupt a
 * pathological diagram mid-render; it bounds the wait and keeps the block
 * from spinning forever when rendering stalls.
 */
export const MERMAID_RENDER_TIMEOUT_MS = 10_000;

/**
 * Configuration keys reviewed content cannot change through an
 * `%%{init: …}%%` directive or YAML front matter. Mermaid folds both into
 * the same directive path and drops every key listed in `secure` before it
 * is applied, so the values `initialize` sets below are the only ones a
 * diagram ever renders with. The first six are Mermaid's own defaults,
 * restated so the policy does not depend on them; the rest are the keys a
 * diagram could use to inject CSS or HTML, change text measurement, or
 * weaken label sanitization.
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

/**
 * Render diagram source to an SVG string inside a hidden, off-screen
 * container that exists only for the duration of the call. Mermaid needs
 * a live element to measure text against, so the container is attached to
 * the document, but it is invisible, outside the `.self-review` subtree,
 * and removed again whether rendering succeeds or fails. Nothing Mermaid
 * produces stays in the application document.
 */
async function renderMermaidSvg(code: string, isDark: boolean): Promise<string> {
  const mermaid = (await import('mermaid')).default;

  // Re-initialize on every render so diagrams pick up the current palette
  // and so a previous diagram's directives never carry over.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    secure: [...MERMAID_SECURE_KEYS],
    theme: isDark ? 'dark' : 'default',
    // Labels as SVG text rather than <foreignObject> HTML: the output is a
    // self-contained SVG document that renders identically through <img>.
    htmlLabels: false,
    maxTextSize: MERMAID_MAX_SOURCE_CHARS,
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
  try {
    // mermaid.render requires a unique ID per call; bump the counter so
    // re-renders after theme changes don't collide.
    const { svg } = await mermaid.render(`mermaid-${mermaidIdCounter++}`, code, sandbox);
    return svg;
  } finally {
    sandbox.remove();
  }
}

interface DiagramImage {
  src: string;
  width: number | undefined;
  height: number | undefined;
}

/**
 * Turn Mermaid's SVG string into the attributes of an isolated `<img>`.
 * The markup is parsed as XML first, with scripting disabled, because an
 * `<img>` shows a malformed SVG as a broken image with no explanation; a
 * contained error message is better. The viewBox gives the image its
 * intrinsic size, which a percentage-width SVG otherwise lacks.
 */
function toDiagramImage(svg: string): DiagramImage {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (
    !root ||
    doc.getElementsByTagName('parsererror').length > 0 ||
    root.namespaceURI !== SVG_NAMESPACE ||
    root.localName !== 'svg'
  ) {
    throw new Error('The diagram did not render to a well-formed SVG image');
  }

  const viewBox = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , width, height] = viewBox.length === 4 ? viewBox : [];
  const sized = width !== undefined && width > 0 && height !== undefined && height > 0;

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
 * Renders a ```mermaid fence as an image. The generated SVG never joins the
 * application document: it is encoded into a `data:` URI and shown through
 * `<img>`, the same boundary `RenderedSvgView` uses for reviewed SVG files,
 * so stylesheets or markup a diagram smuggles into its output stay inside
 * the image and cannot style or cover review controls.
 */
export default function MermaidBlock({ code }: { code: string }) {
  const [state, setState] = useState<BlockState>({ status: 'pending' });
  const { config } = useConfig();
  const isDark = resolveIsDark(config.theme);

  useEffect(() => {
    if (code.length > MERMAID_MAX_SOURCE_CHARS) {
      setState({
        status: 'error',
        message:
          `Diagram source is too large (${code.length.toLocaleString()} characters; ` +
          `the limit is ${MERMAID_MAX_SOURCE_CHARS.toLocaleString()})`,
      });
      return;
    }

    let settled = false;
    const settle = (next: BlockState) => {
      if (settled) return;
      settled = true;
      setState(next);
    };

    setState({ status: 'pending' });
    const timer = window.setTimeout(() => {
      settle({
        status: 'error',
        message: `Rendering timed out after ${MERMAID_RENDER_TIMEOUT_MS / 1000} seconds`,
      });
    }, MERMAID_RENDER_TIMEOUT_MS);

    renderMermaidSvg(code, isDark)
      .then(svg => settle({ status: 'rendered', image: toDiagramImage(svg) }))
      .catch((err: unknown) =>
        settle({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to render diagram',
        })
      )
      .finally(() => window.clearTimeout(timer));

    return () => {
      settled = true;
      window.clearTimeout(timer);
    };
  }, [code, isDark]);

  if (state.status === 'error') {
    return (
      <div
        data-testid='mermaid-error'
        className='text-destructive text-sm p-2 border border-destructive/20 rounded'
      >
        Mermaid error: {state.message}
      </div>
    );
  }
  if (state.status === 'pending') return <div className='animate-pulse bg-muted h-32 rounded' />;
  return (
    <div className='mermaid-block flex justify-center overflow-x-auto max-w-full rounded-lg border border-border bg-white dark:bg-muted/20 p-4'>
      <img
        src={state.image.src}
        alt='Mermaid diagram'
        width={state.image.width}
        height={state.image.height}
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
