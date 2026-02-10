import React, { createContext, useContext, useState } from 'react';
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

const ConfigContext = createContext<{
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}>({
  config: defaultConfig,
  setConfig: () => { /* stub */ },
});

export function useConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);

  return (
    <ConfigContext.Provider value={{ config, setConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export default ConfigContext;
