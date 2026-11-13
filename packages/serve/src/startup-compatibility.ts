// Compatibility entry point. First-party composition uses the normalized engine.
import { installedServeEngine } from './engine-contract';
export { startupSourceFor } from './engine-contract';
export const resolveCompatibleStartupSource = installedServeEngine.resolveSource;
