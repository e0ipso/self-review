// Compatibility defaults are loaded only when the caller omitted them.
import type { DesktopSession } from './desktop-session';
import type { StartupOperations } from './startup-operations';
import type { ReviewPresentation } from './presentation';
import { initializeSuppliedSession } from './startup-policy';

export async function initializeSession(
  desktop: DesktopSession,
  signal = desktop.operations.signal,
  confirm?: ReviewPresentation['confirmPayload'],
  operations?: StartupOperations
): Promise<boolean> {
  const confirmLoad = confirm ?? (await import('./presentation')).confirmPayload;
  const effects = operations ?? (await import('./startup-operations')).defaultStartupOperations;
  return initializeSuppliedSession(desktop, signal, confirmLoad, effects);
}
