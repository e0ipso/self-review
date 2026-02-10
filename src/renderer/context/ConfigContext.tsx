import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AppConfig } from '../../shared/types';

const defaultConfig: AppConfig = {
  theme: 'system',
  diffView: 'split',
  prismTheme: 'one-dark',
  fontSize: 14,
  outputFormat: 'xml',
  ignore: [],
  categories: [],
  defaultDiffArgs: '--staged',
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
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  // Apply theme to document element
  useEffect(() => {
    const applyTheme = (theme: 'light' | 'dark' | 'system') => {
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
      } else {
        document.documentElement.classList.toggle('dark', theme === 'dark');
      }
    };

    applyTheme(config.theme);

    // Listen for system theme changes when in system mode
    if (config.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [config.theme]);

  // Register IPC listener for config from main process
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onConfigLoad((payload) => {
        setConfig(payload);
      });
    }
  }, []);

  return (
    <ConfigContext.Provider value={{ config, setConfig, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}
