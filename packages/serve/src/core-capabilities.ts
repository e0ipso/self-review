// Report only known installed-engine limitations; no negotiation or wire changes.
// Remove these diagnostics with the 2.0.4 shims once the published minimum
// includes asynchronous source detection, local loading, Apply and publication.
import * as core from '@self-review/core';

interface CoreCapabilities {
  resolveStartupSourceAsync?: unknown;
  applySuggestionForSessionAsync?: unknown;
  loadSyntheticFilesAsync?: unknown;
  MAX_PUBLICATION_ASSET_BYTES?: unknown;
}

export function reportCoreCompatibility(
  report: (message: string) => void,
  engine: CoreCapabilities = core
): void {
  if (typeof engine.resolveStartupSourceAsync !== 'function')
    report(
      '[serve] Installed core uses a synchronous startup probe; it blocks the event loop and cannot be interrupted.'
    );
  if (typeof engine.applySuggestionForSessionAsync !== 'function')
    report(
      '[serve] Installed core uses synchronous Apply; deadlines and shutdown may be delayed during a write. Check the destination after a lost response; never replay automatically.'
    );
  if (typeof engine.loadSyntheticFilesAsync !== 'function')
    report(
      '[serve] Installed core local loading does not support the startup signal; cancellation may wait for filesystem work.'
    );
  if (typeof engine.MAX_PUBLICATION_ASSET_BYTES !== 'number')
    report(
      '[serve] Installed core publication lacks the aggregate asset budget and cooperative staging cancellation. The HTTP body limit does not bound resumed assets read from disk.'
    );
}
