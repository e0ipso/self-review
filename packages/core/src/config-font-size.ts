// Pure policy shared by the YAML loader and hosts adapting older Core configuration.
import { createDefaultConfig } from '../../config/src/index';

export function normalizeConfigFontSize<T extends { fontSize: number }>(
  config: T,
  fallback: number = createDefaultConfig().fontSize
): { config: T; diagnostic?: string } {
  if (Number.isFinite(config.fontSize)) return { config };
  return {
    config: { ...config, fontSize: fallback },
    diagnostic: `Warning: Invalid font-size value "${String(config.fontSize)}", expected a finite number; using a finite fallback`,
  };
}
