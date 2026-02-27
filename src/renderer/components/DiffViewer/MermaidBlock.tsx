import { useState, useRef, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';

let mermaidIdCounter = 0;

function resolveIsDark(theme: 'light' | 'dark' | 'system'): boolean {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return theme === 'dark';
}

export default function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${mermaidIdCounter++}`);
  const { config } = useConfig();
  const isDark = resolveIsDark(config.theme);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        // Re-initialize mermaid on every theme change so diagrams
        // pick up the correct palette.
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
        });

        // mermaid.render requires a unique ID per call; bump the counter
        // so re-renders after theme changes don't collide.
        const renderId = `mermaid-${mermaidIdCounter++}`;
        const { svg: rendered } = await mermaid.render(renderId, code);
        if (!cancelled) setSvg(rendered);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code, isDark]);

  if (error) {
    return (
      <div className='text-destructive text-sm p-2 border border-destructive/20 rounded'>
        Mermaid error: {error}
      </div>
    );
  }
  if (!svg) return <div className='animate-pulse bg-muted h-32 rounded' />;
  return (
    <div
      className="overflow-hidden max-w-full rounded bg-white dark:bg-transparent p-4 [&>svg]:max-w-full [&>svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
