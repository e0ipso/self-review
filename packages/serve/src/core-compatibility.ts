// Compatibility entry point. First-party composition uses the normalized engine.
import { installedServeEngine } from './engine-contract';
export { reviewStateValidatorFor } from './engine-contract';
export const validateCompatibleReviewState = installedServeEngine.validateReviewState;
