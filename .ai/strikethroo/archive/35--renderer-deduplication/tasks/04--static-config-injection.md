---
id: 4
group: "lifecycle-boundaries"
dependencies: [2]
status: "pending"
created: "2026-03-11"
skills:
  - "react-components"
  - "typescript"
---
# Static Initial Config Injection into Package Providers

## Objective
Refactor package-side context providers (`packages/react/src/context/`) to accept static initial config and output-path values as props from the renderer shell, eliminating any direct Electron IPC subscriptions inside package code.

## Skills Required
- react-components (React context provider refactor)
- TypeScript (interface/prop types)

## Acceptance Criteria
- [ ] `packages/react/src/context/ConfigContext.tsx` (or equivalent) receives `AppConfig` as an initial prop from the renderer shell, not via `window.electronAPI` calls
- [ ] `packages/react/src/context/` code contains no references to `window.electronAPI`, `requestConfig`, `onConfigLoad`, or `onOutputPathChanged`
- [ ] Renderer shell (`src/renderer/App.tsx` or equivalent) continues to own config IPC interaction and passes resolved values into package providers at mount
- [ ] Output-path change events (initiated by package UI) are handled via an adapter callback prop rather than direct IPC
- [ ] `rg "window\\.electronAPI" packages/react/src` returns no matches
- [ ] `npm run test:unit` and `npm run --workspace @self-review/react test:unit` pass

## Technical Requirements
- `AppConfig` type from `@self-review/core`
- Renderer shell reads config via IPC on startup, then passes it as prop to package provider
- For runtime output-path changes: package component calls an `onOutputPathChange` adapter prop; renderer shell wires this to `window.electronAPI`

## Input Dependencies
- Task 02: resolver alignment so `@self-review/core` types resolve in package

## Output Artifacts
- Updated `packages/react/src/context/ConfigContext.tsx` (and related context files)
- Updated `src/renderer/App.tsx` (or shell component) that passes static config as props
- Adapter prop interface for output-path change callback

## Implementation Notes

<details>
<summary>Refactor approach</summary>

**Pattern to follow:**
```tsx
// packages/react/src/context/ConfigContext.tsx
interface ConfigProviderProps {
  initialConfig: AppConfig;
  initialOutputPath: OutputPathInfo | null;
  onOutputPathChange?: (path: OutputPathInfo | null) => void;
  children: React.ReactNode;
}

export function ConfigProvider({ initialConfig, initialOutputPath, onOutputPathChange, children }: ConfigProviderProps) {
  const [config] = useState(initialConfig);
  const [outputPath, setOutputPath] = useState(initialOutputPath);
  // ...
}
```

**Renderer shell:**
```tsx
// src/renderer/App.tsx
const [config, setConfig] = useState<AppConfig | null>(null);
useEffect(() => {
  window.electronAPI.requestConfig();
  window.electronAPI.onConfigLoad((cfg) => setConfig(cfg));
  window.electronAPI.onOutputPathChanged((info) => setOutputPath(info));
}, []);

if (!config) return null;
return (
  <ConfigProvider
    initialConfig={config}
    initialOutputPath={outputPath}
    onOutputPathChange={(p) => window.electronAPI.changeOutputPath(p)}
  >
    ...
  </ConfigProvider>
);
```

Steps:
1. Identify existing config/output-path IPC calls in `packages/react/src/context/`
2. Remove IPC calls, convert to props
3. Update renderer shell to pass values
4. Run `rg "window\\.electronAPI" packages/react/src` to confirm clean
</details>
