import type { MessageKey } from './LocalizationContext';

// Only application-owned, exact messages are translated. Host/command diagnostics
// and the controller's public error strings remain unchanged.
const MESSAGES = new Set<MessageKey>([
  'The host request failed.',
  'The host did not acknowledge saved feedback.',
  'Saved feedback belongs to an earlier remote snapshot. The host must supply feedback for the current snapshot.',
]);
export function recoveryMessageKey(message: string): MessageKey | undefined {
  return MESSAGES.has(message as MessageKey) ? (message as MessageKey) : undefined;
}
