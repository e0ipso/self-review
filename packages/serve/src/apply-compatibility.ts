// Compatibility entry point. First-party composition uses the normalized engine.
import { installedServeEngine } from './engine-contract';
export { applyFor } from './engine-contract';
export type { ApplyOptions } from './engine-contract';
export const applyCompatibleSuggestion = installedServeEngine.applySuggestion;
