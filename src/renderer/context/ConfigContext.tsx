import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import type { AppConfig } from '../../shared/types';
import lightThemeCss from 'prismjs/themes/prism.css?raw';
import darkThemeCss from 'prism-themes/themes/prism-one-dark.css?raw';

const defaultConfig: AppConfig = {
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
      name: 'nit',
      description: 'Minor nitpick, low priority',
      color: '#718096',
    },
  ],
  defaultDiffArgs: '--staged',
  showUntracked: true,
  wordWrap: true,
};

interface ConfigContextValue {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
  updateConfig: (updates: Partial<AppConfig>) => void;
}

const ConfigContext = createContext<ConfigContextValue>({
  config: defaultConfig,
  setConfig: () => {},
  updateConfig: () => {},
});

export function useConfig() {
  return useContext(ConfigContext);
}

interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);

  const updateConfig = (updates: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // Apply theme to document element and swap Prism syntax theme
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      document.documentElement.classList.toggle('dark', isDark);

      let styleEl = document.getElementById(
        'prism-theme'
      ) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'prism-theme';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = isDark ? darkThemeCss : lightThemeCss;
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
  }, [config.theme]);

  // Register IPC listener for config from main process
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onConfigLoad(payload => {
        setConfig(payload);
      });
      // Request config data
      window.electronAPI.requestConfig();
    }
  }, []);

  return (
    <ConfigContext.Provider value={{ config, setConfig, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}
