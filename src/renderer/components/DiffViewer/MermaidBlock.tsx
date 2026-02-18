import { useState, useRef, useEffect } from 'react';

let mermaidInitialized = false;
let mermaidIdCounter = 0;

export default function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${mermaidIdCounter++}`);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        const isDark = document.documentElement.classList.contains('dark');

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
          });
          mermaidInitialized = true;
        }

        const { svg: rendered } = await mermaid.render(idRef.current, code);
        if (!cancelled) setSvg(rendered);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className='text-destructive text-sm p-2 border border-destructive/20 rounded'>
        Mermaid error: {error}
      </div>
    );
  }
  if (!svg) return <div className='animate-pulse bg-muted h-32 rounded' />;
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
