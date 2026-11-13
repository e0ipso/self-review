// Report supported installed-engine limitations without disabling capabilities.
import {
  installedServeEngine,
  coreCompatibilityDiagnostics,
  type CoreCapabilityShape,
} from './engine-contract';

export function reportCoreCompatibility(
  report: (message: string) => void,
  engine?: CoreCapabilityShape
): void {
  const messages = engine
    ? coreCompatibilityDiagnostics(engine)
    : installedServeEngine.compatibilityDiagnostics;
  for (const message of messages) report(message);
}
