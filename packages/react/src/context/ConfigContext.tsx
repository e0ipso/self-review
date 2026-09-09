import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import type { AppConfig, OutputPathInfo } from '@self-review/types';
import { hasUsableCategory } from '../utils/category-utils';

export const defaultConfig: AppConfig = {
  theme: 'system',
  diffView: 'split',
  fontSize: 14,
  outputFormat: 'xml',
  outputFile: './review.xml',
  ignore: [],
  categories: [
    {
      name: 'bug',
      description: 'Likely defect or incorrect behavior',
      color: '#e53e3e',
    },
    {
      name: 'security',
      description: 'Security vulnerability or concern',
      color: '#dd6b20',
    },
    {
      name: 'style',
      description: 'Code style, naming, or formatting issue',
      color: '#3182ce',
    },
    {
      name: 'question',
      description: 'Clarification needed — not necessarily a problem',
      color: '#805ad5',
    },
    {
      name: 'task',
      description: 'Action item or follow-up task',
      color: '#38a169',
    },
    {
      name: 'nit',
      description: 'Minor nitpick, low priority',
      color: '#718096',
    },
  ],
  defaultDiffArgs: '--staged',
  showUntracked: true,
  showUntrackedExplicit: false,
  wordWrap: true,
  maxFiles: 500,
  maxTotalLines: 100000,
};

export interface ConfigContextValue {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
  updateConfig: (updates: Partial<AppConfig>) => void;
  outputPathInfo: OutputPathInfo;
  setOutputPathInfo: (info: OutputPathInfo) => void;
  /** The .self-review wrapper div — used as container for Radix/Base UI portals */
  portalContainer: HTMLDivElement | null;
}

const defaultOutputPathInfo: OutputPathInfo = {
  resolvedOutputPath: '',
  outputPathWritable: true,
};

const ConfigContext = createContext<ConfigContextValue>({
  config: defaultConfig,
  setConfig: () => {},
  updateConfig: () => {},
  outputPathInfo: defaultOutputPathInfo,
  setOutputPathInfo: () => {},
  portalContainer: null,
});

export function useConfig() {
  return useContext(ConfigContext);
}

export interface ConfigProviderProps {
  children: ReactNode;
  /** Initial config to merge with defaults */
  initialConfig?: Partial<AppConfig>;
  /** Initial output path info */
  initialOutputPath?: OutputPathInfo;
  /** CSS string for light Prism theme (optional, for non-webpack environments) */
  prismLightCss?: string;
  /** CSS string for dark Prism theme (optional, for non-webpack environments) */
  prismDarkCss?: string;
}

// A `categories` list that leaves no usable entry (empty list, every entry shaped
// wrong, or every entry named '') would silently disable commenting the same way
// an unusable YAML `categories` config does for the Node-only loader (SR-0014).
// An embedder-supplied `config` prop gets no equivalent check before this point
// (ReviewPanel and SingleFileReview forward it here unmodified), so this merge
// applies the same fallback: keep defaults and warn.
function mergeInitialConfig(initialConfig: Partial<AppConfig> | undefined): AppConfig {
  const merged: AppConfig = { ...defaultConfig, ...initialConfig };
  if (!hasUsableCategory(merged.categories)) {
    console.error(
      'Warning: Category configuration has no usable categories, using default categories'
    );
    return { ...merged, categories: defaultConfig.categories };
  }
  return merged;
}

export function ConfigProvider({
  children,
  initialConfig,
  initialOutputPath,
  prismLightCss,
  prismDarkCss,
}: ConfigProviderProps) {
  // Lazy initializer: runs once on mount, not on every render, so the
  // fallback's console.error doesn't re-fire on unrelated re-renders.
  const [config, setConfig] = useState<AppConfig>(() => mergeInitialConfig(initialConfig));
  const [outputPathInfo, setOutputPathInfo] = useState<OutputPathInfo>(
    initialOutputPath || defaultOutputPathInfo
  );

  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  // Tracks the scoped <style> element injected into the wrapper div for Prism theme CSS
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Callback ref fires synchronously during React's commit phase — before effects and before
  // the browser paints. This ensures portalContainer is non-null from the first render.
  const wrapperCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setPortalContainer(node);
    }
  }, []);

  const updateConfig = (updates: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // Apply theme to the .self-review wrapper (scoped) and swap Prism syntax theme
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      // Toggle dark class on the scoped wrapper instead of document.documentElement
      if (portalContainer) {
        portalContainer.classList.toggle('dark', isDark);
      }

      // Apply Prism theme CSS scoped to this instance's wrapper div (not document.head)
      if (prismLightCss || prismDarkCss) {
        if (!styleRef.current && portalContainer) {
          const el = document.createElement('style');
          portalContainer.appendChild(el);
          styleRef.current = el;
        }
        if (styleRef.current) {
          styleRef.current.textContent = isDark ? (prismDarkCss || '') : (prismLightCss || '');
        }
      }
    };

    const resolveIsDark = (theme: 'light' | 'dark' | 'system') => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return theme === 'dark';
    };

    applyTheme(resolveIsDark(config.theme));

    let removeMediaListener: (() => void) | undefined;
    // Listen for system theme changes when in system mode
    if (config.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };
      mediaQuery.addEventListener('change', listener);
      removeMediaListener = () => mediaQuery.removeEventListener('change', listener);
    }

    return () => {
      removeMediaListener?.();
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
    };
  }, [config.theme, prismLightCss, prismDarkCss, portalContainer]);

  return (
    <ConfigContext.Provider value={{ config, setConfig, updateConfig, outputPathInfo, setOutputPathInfo, portalContainer }}>
      <div ref={wrapperCallbackRef} className="self-review" style={{ display: 'contents' }}>
        {children}
      </div>
    </ConfigContext.Provider>
  );
}
