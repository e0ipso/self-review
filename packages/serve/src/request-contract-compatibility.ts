// Compatibility entry point. First-party composition uses the normalized engine.
import { installedServeEngine } from './engine-contract';
export { requestContractFor } from './engine-contract';
export const requestContract = installedServeEngine.requestContract;
