import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import type { AppConfig, OutputPathInfo } from '@self-review/types';

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

export function ConfigProvider({
  children,
  initialConfig,
  initialOutputPath,
  prismLightCss,
  prismDarkCss,
}: ConfigProviderProps) {
  const [config, setConfig] = useState<AppConfig>({
    ...defaultConfig,
    ...initialConfig,
  });
  const [outputPathInfo, setOutputPathInfo] = useState<OutputPathInfo>(
    initialOutputPath || defaultOutputPathInfo
  );

  // Ref for the .self-review wrapper div — used for theme scoping and portal containment
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  // Expose the wrapper div as the portal container after mount
  useEffect(() => {
    setPortalContainer(wrapperRef.current);
  }, []);

  const updateConfig = (updates: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // Apply theme to the .self-review wrapper (scoped) and swap Prism syntax theme
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      // Toggle dark class on the scoped wrapper instead of document.documentElement
      if (wrapperRef.current) {
        wrapperRef.current.classList.toggle('dark', isDark);
      }

      // Apply Prism theme CSS if provided
      if (prismLightCss || prismDarkCss) {
        let styleEl = document.getElementById(
          'prism-theme'
        ) as HTMLStyleElement | null;
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'prism-theme';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = isDark ? (prismDarkCss || '') : (prismLightCss || '');
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
    if (config.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [config.theme, prismLightCss, prismDarkCss]);

  return (
    <ConfigContext.Provider value={{ config, setConfig, updateConfig, outputPathInfo, setOutputPathInfo, portalContainer }}>
      <div ref={wrapperRef} className="self-review" style={{ display: 'contents' }}>
        {children}
      </div>
    </ConfigContext.Provider>
  );
}
