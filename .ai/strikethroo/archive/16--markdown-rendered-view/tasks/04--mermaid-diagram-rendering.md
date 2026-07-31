---
id: 4
group: "rendered-markdown-view"
dependencies: [2]
status: "completed"
created: "2026-02-18"
skills: ["react-components"]
---

# Add Mermaid Diagram Rendering

## Objective

Detect ` ```mermaid ` code blocks in the rendered markdown view and render them as inline SVG diagrams using `mermaid.js` instead of displaying raw mermaid syntax. The rendering must respect the app's light/dark theme.

## Skills Required

React component development, async rendering patterns, mermaid.js API usage.

## Acceptance Criteria

- [ ] Code blocks with language `mermaid` render as SVG diagrams in the rendered markdown view
- [ ] Mermaid diagrams respect the app's current theme (dark theme → mermaid dark theme, light → default)
- [ ] Diagram blocks retain `data-source-start-line` / `data-source-end-line` attributes and are commentable via the gutter
- [ ] A loading placeholder is shown while the async mermaid render completes
- [ ] Invalid mermaid syntax shows a graceful error message instead of crashing

## Technical Requirements

- Mermaid's `render()` API is async and produces an SVG string.
- Initialize mermaid with `mermaid.initialize({ startOnLoad: false, theme: 'dark' | 'default' })`.
- The theme should be read from the app's config context or by detecting the current `dark` class on the document.
- Use `dangerouslySetInnerHTML` to insert the SVG string into a container div.
- Each mermaid block must have a unique ID for mermaid's `render()` call.

## Input Dependencies

Task 2: `RenderedMarkdownView` component with custom code block renderer infrastructure.

## Output Artifacts

- Mermaid rendering integrated into the `code` renderer in `RenderedMarkdownView.tsx`
- A `MermaidBlock` sub-component (can be in the same file or a separate small file)

## Implementation Notes

<details>

### MermaidBlock component

```tsx
import mermaid from 'mermaid';

let mermaidInitialized = false;
let idCounter = 0;

function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${idCounter++}`);

  useEffect(() => {
    // Detect theme
    const isDark = document.documentElement.classList.contains('dark');

    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
      });
      mermaidInitialized = true;
    }

    mermaid.render(idRef.current, code)
      .then(({ svg }) => setSvg(svg))
      .catch((err) => setError(err.message || 'Failed to render diagram'));
  }, [code]);

  if (error) return <div className="text-destructive text-sm p-2 border border-destructive/20 rounded">Mermaid error: {error}</div>;
  if (!svg) return <div className="animate-pulse bg-muted h-32 rounded" />;
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

### Integration into code renderer

In the custom `code` renderer from task 2, check if the language is `mermaid`:

```tsx
function CodeRenderer({ className, children, node, ...props }) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  if (lang === 'mermaid') {
    return <MermaidBlock code={code} />;
  }

  // ... existing Prism highlighting logic
}
```

### Theme reactivity

For V1, reading the theme once on mount is sufficient. If the user toggles the theme while viewing, the mermaid diagrams won't re-render — this is acceptable for initial implementation.

### Unique ID management

Mermaid's `render()` requires a unique DOM element ID. Use a module-level counter or `useId()` hook (React 18+). Ensure IDs don't collide if multiple mermaid blocks exist in the same file.

### Error handling

Wrap `mermaid.render()` in try/catch. Invalid mermaid syntax should show an inline error message, not crash the component. Use React error boundaries as a safety net if needed.

</details>
