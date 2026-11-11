import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import type { AppConfig, OutputPathInfo } from '@self-review/types';
import { hasUsableCategory } from '../utils/category-utils';
import { DEFAULT_CONFIG, DEFAULT_FONT_SIZE } from '../config-defaults';
import { cloneConfig, createDefaultConfig } from '../../../config/src/index';

/** Kept under this name for the package's public API. */
export const defaultConfig: AppConfig = DEFAULT_CONFIG;

/** Compatibility value. Prefer focused hooks for new consumers. */
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

/** Compatibility facade containing configuration, output status and portal ownership. */
export function useConfig() {
  return useContext(ConfigContext);
}

export type ConfigurationValue = Pick<ConfigContextValue, 'config' | 'setConfig' | 'updateConfig'>;
export type OutputPathValue = Pick<ConfigContextValue, 'outputPathInfo' | 'setOutputPathInfo'>;
export type AppearanceValue = Pick<AppConfig, 'theme' | 'diffView' | 'fontSize' | 'wordWrap'> &
  Pick<ConfigContextValue, 'updateConfig'>;

const ConfigurationContext = createContext<ConfigurationValue>({
  config: defaultConfig,
  setConfig: () => {},
  updateConfig: () => {},
});
const AppearanceContext = createContext<AppearanceValue>({
  theme: defaultConfig.theme,
  diffView: defaultConfig.diffView,
  fontSize: defaultConfig.fontSize,
  wordWrap: defaultConfig.wordWrap,
  updateConfig: () => {},
});
const CategoriesContext = createContext(defaultConfig.categories);
const OutputPathContext = createContext<OutputPathValue>({
  outputPathInfo: defaultOutputPathInfo,
  setOutputPathInfo: () => {},
});
const PortalContext = createContext<HTMLDivElement | null>(null);

/** Configuration and its mutation operations, independent of output and portal changes. */
export function useConfiguration() {
  return useContext(ConfigurationContext);
}
/** Appearance settings, independent of categories and output status. */
export function useAppearance() {
  return useContext(AppearanceContext);
}
/** The configured categories, including the initial fallback when no category is usable. */
export function useCategories() {
  return useContext(CategoriesContext);
}
/** Output destination metadata and its existing replacement operation. */
export function useOutputPath() {
  return useContext(OutputPathContext);
}
/** The scoped review root used for portals and review-local DOM events. */
export function usePortalContainer() {
  return useContext(PortalContext);
}

export interface ConfigProviderProps {
  children: ReactNode;
  /** Merged with defaults once per mount. Later prop changes do not replace user edits. */
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
  const defaults = createDefaultConfig();
  const merged: AppConfig = { ...defaults, ...initialConfig };
  if (!hasUsableCategory(merged.categories)) {
    console.error(
      'Warning: Category configuration has no usable categories, using default categories'
    );
    return cloneConfig({ ...merged, categories: defaults.categories });
  }
  return cloneConfig(merged);
}

/** Carries the configured `font-size` (px); `.sr-diff-code` in styles.css reads it. */
export const FONT_SIZE_CSS_VAR = '--sr-font-size';

// `font-size` is only known to be a number, which admits 0, negatives, NaN and Infinity.
function resolveFontSize(fontSize: number): number {
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : DEFAULT_FONT_SIZE;
}

export function ConfigProvider({
  children,
  initialConfig,
  initialOutputPath,
}: ConfigProviderProps) {
  // Lazy initializer: runs once on mount, not on every render, so the
  // fallback's console.error doesn't re-fire on unrelated re-renders.
  const [config, replaceConfig] = useState<AppConfig>(() => mergeInitialConfig(initialConfig));
  const [outputPathInfo, setOutputPathInfo] = useState<OutputPathInfo>(() => ({
    ...(initialOutputPath || defaultOutputPathInfo),
  }));

  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  // Callback ref fires synchronously during React's commit phase — before effects and before
  // the browser paints. This ensures portalContainer is non-null from the first render.
  const wrapperCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setPortalContainer(node);
    }
  }, []);

  // Retain React's functional-setter call form as well as complete replacements.
  const setConfig = useCallback((next: React.SetStateAction<AppConfig>) => {
    if (typeof next === 'function') replaceConfig(prev => cloneConfig(next(prev)));
    else replaceConfig(cloneConfig(next));
  }, []);
  const updateConfig = useCallback((updates: Partial<AppConfig>) => {
    // Copy incoming nested values now; callers can reuse or mutate their own objects afterwards.
    const owned = { ...updates };
    if (owned.ignore) owned.ignore = [...owned.ignore];
    if (owned.categories) owned.categories = owned.categories.map(category => ({ ...category }));
    replaceConfig(prev => ({ ...prev, ...owned }));
  }, []);

  const configuration = useMemo(
    () => ({ config, setConfig, updateConfig }),
    [config, setConfig, updateConfig]
  );
  const appearance = useMemo(
    () => ({
      theme: config.theme,
      diffView: config.diffView,
      fontSize: config.fontSize,
      wordWrap: config.wordWrap,
      updateConfig,
    }),
    [config.theme, config.diffView, config.fontSize, config.wordWrap, updateConfig]
  );
  const output = useMemo(() => ({ outputPathInfo, setOutputPathInfo }), [outputPathInfo]);
  const compatibility = useMemo(
    () => ({
      ...configuration,
      ...output,
      portalContainer,
    }),
    [configuration, output, portalContainer]
  );

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
    <ConfigContext.Provider value={compatibility}>
      <ConfigurationContext.Provider value={configuration}>
        <AppearanceContext.Provider value={appearance}>
          <CategoriesContext.Provider value={config.categories}>
            <OutputPathContext.Provider value={output}>
              <PortalContext.Provider value={portalContainer}>
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
              </PortalContext.Provider>
            </OutputPathContext.Provider>
          </CategoriesContext.Provider>
        </AppearanceContext.Provider>
      </ConfigurationContext.Provider>
    </ConfigContext.Provider>
  );
}
