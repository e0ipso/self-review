import { exceedsMermaidComplexity, MERMAID_MAX_EDGES } from './mermaid-budget';

/** Longer diagram source is never handed to Mermaid; also pinned as its `maxTextSize`. */
export const MERMAID_MAX_SOURCE_CHARS = 50_000;

/** Bounds waiting after the event loop yields; it cannot interrupt synchronous layout. */
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

export const MERMAID_MAX_ADMITTED_RENDERS = 8;

/** Trusted host service input. Source is untrusted and must never execute scripts or load URLs. */
export interface DiagramRenderRequest {
  source: string;
  theme: 'light' | 'dark';
  signal: AbortSignal;
}

/**
 * Resolve/reject only after the actual job and its cleanup settle, including after abort.
 * Cancellation is cooperative. A renderer may terminate its own isolated context, but must
 * never report completion while synchronous layout is still active. The host owns service
 * lifetime; views abort their requests on replacement/unmount and never dispose a shared service.
 * Return SVG text only, never live DOM, URLs, event handlers or executable markup.
 */
export interface DiagramRenderService {
  render(request: DiagramRenderRequest): Promise<{ svg: string }>;
}

export class DiagramImageError extends Error {
  constructor(readonly kind: 'svg' | 'size' | 'busy' | 'source') {
    super(kind);
  }
}

/**
 * Serial, bounded admission around a host layout implementation. Slots remain occupied until
 * layout settles, even after a caller stops waiting. The layout owns cancellation and cleanup.
 * Configure the implementation once outside React; theme is the only per-request variation.
 */
export function createDiagramRenderService(
  layout: (request: DiagramRenderRequest) => Promise<{ svg: string }>
): DiagramRenderService {
  let queue: Promise<unknown> = Promise.resolve();
  let admitted = 0;
  return {
    render(request) {
      if (
        request.source.length > MERMAID_MAX_SOURCE_CHARS ||
        exceedsMermaidComplexity(request.source)
      )
        return Promise.reject(new DiagramImageError('source'));
      if (request.signal.aborted) return Promise.reject(request.signal.reason);
      if (admitted >= MERMAID_MAX_ADMITTED_RENDERS)
        return Promise.reject(new DiagramImageError('busy'));
      admitted++;
      const result = queue
        .then(() => {
          request.signal.throwIfAborted();
          return layout(request);
        })
        .finally(() => {
          admitted--;
        });
      queue = result.catch(() => {});
      return result;
    },
  };
}

let mermaidIdCounter = 0;

/** Renders in a hidden off-screen container (outside `.self-review`) removed on success or failure. */
async function renderQueuedSvg({
  source: code,
  theme,
  signal,
}: DiagramRenderRequest): Promise<{ svg: string }> {
  const isDark = theme === 'dark';
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
    return { svg };
  } finally {
    signal.removeEventListener('abort', remove);
    sandbox.remove();
  }
}

// One queue for the shared Mermaid configuration, including independently mounted reviews.
export const defaultDiagramRenderService = createDiagramRenderService(renderQueuedSvg);
