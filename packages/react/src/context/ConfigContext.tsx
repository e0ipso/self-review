import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { AppConfig, OutputPathInfo } from '@self-review/types';
import { hasUsableCategory } from '../utils/category-utils';
import { DEFAULT_CONFIG } from '../config-defaults';

/** Kept under this name for the package's public API. */
export const defaultConfig: AppConfig = DEFAULT_CONFIG;

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

/** Carries the configured `font-size` (px); `.sr-diff-code` in styles.css reads it. */
export const FONT_SIZE_CSS_VAR = '--sr-font-size';

// `font-size` is only known to be a number, which admits 0, negatives, NaN and Infinity.
function resolveFontSize(fontSize: number): number {
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : defaultConfig.fontSize;
}

export function ConfigProvider({
  children,
  initialConfig,
  initialOutputPath,
}: ConfigProviderProps) {
  // Lazy initializer: runs once on mount, not on every render, so the
  // fallback's console.error doesn't re-fire on unrelated re-renders.
  const [config, setConfig] = useState<AppConfig>(() => mergeInitialConfig(initialConfig));
  const [outputPathInfo, setOutputPathInfo] = useState<OutputPathInfo>(
    initialOutputPath || defaultOutputPathInfo
  );

  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

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

  // Toggling `dark` is the whole theme switch: both Prism themes are pre-scoped in the stylesheet.
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      if (portalContainer) {
        portalContainer.classList.toggle('dark', isDark);
      }
    };

    const resolveIsDark = (theme: 'light' | 'dark' | 'system') => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return theme === 'dark';
    };

    applyTheme(resolveIsDark(config.theme));

    // Listen for system theme changes when in system mode
    if (config.theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      applyTheme(e.matches);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [config.theme, portalContainer]);

  return (
    <ConfigContext.Provider
      value={{
        config,
        setConfig,
        updateConfig,
        outputPathInfo,
        setOutputPathInfo,
        portalContainer,
      }}
    >
      <div
        ref={wrapperCallbackRef}
        className='self-review'
        style={
          {
            display: 'contents',
            [FONT_SIZE_CSS_VAR]: `${resolveFontSize(config.fontSize)}px`,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </ConfigContext.Provider>
  );
}
