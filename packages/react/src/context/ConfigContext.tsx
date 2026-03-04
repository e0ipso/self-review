import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import type { AppConfig, OutputPathInfo } from '@self-review/core';

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

  const updateConfig = (updates: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // Apply theme to document element and swap Prism syntax theme
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      document.documentElement.classList.toggle('dark', isDark);

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
    <ConfigContext.Provider value={{ config, setConfig, updateConfig, outputPathInfo, setOutputPathInfo }}>
      {children}
    </ConfigContext.Provider>
  );
}
