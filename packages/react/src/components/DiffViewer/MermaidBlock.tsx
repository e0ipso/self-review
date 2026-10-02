import { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
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
async function renderMermaidSvg(code: string, isDark: boolean): Promise<string> {
  const mermaid = (await import('mermaid')).default;

  // Re-initialize per render: current palette, and no directives carried over.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    secure: [...MERMAID_SECURE_KEYS],
    theme: isDark ? 'dark' : 'default',
    // SVG text instead of <foreignObject>, so the output renders identically through <img>.
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
    // mermaid.render needs a unique ID per call.
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
 * Parsed as XML first (scripting off) because `<img>` shows malformed SVG as a bare broken
 * image. The viewBox gives the image the intrinsic size a percentage-width SVG lacks.
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
 * Renders a ```mermaid fence through `<img>` and a `data:` URI, like `RenderedSvgView`, so
 * markup a diagram smuggles into its output cannot style or cover review controls.
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
