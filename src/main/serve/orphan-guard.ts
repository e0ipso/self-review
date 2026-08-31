// src/main/serve/orphan-guard.ts
// Shuts serve mode down when the launcher that spawned it dies.
//
// On Linux `serve` re-launches itself once with --ozone-platform=headless and
// the launcher blocks in spawnSync. Group signals already reach the child, so
// Ctrl-C needs nothing from here. This covers what they cannot: the launcher
// being SIGKILLed, after which the child would keep holding the port under
// init. SIGKILL is unhandleable, so the child has to watch instead.

/** Environment marker set by relaunchHeadless on the child it spawns. */
export const HEADLESS_RELAUNCH_ENV = 'SELF_REVIEW_SERVE_HEADLESS';

/** How often to check. Orphaning is rare and not urgent; polling is cheap. */
const DEFAULT_INTERVAL_MS = 1000;

export interface OrphanGuardOptions {
  /** Reads the current parent pid. Injectable for tests. */
  readParentPid?: () => number;
  /** True when this process is the relaunched child. Injectable for tests. */
  isRelaunchedChild?: () => boolean;
  intervalMs?: number;
}

/**
 * Starts watching for the launcher's death. Returns a function that stops
 * watching, or null when no watch was started (this is not the relaunched
 * child, so it has no launcher to outlive).
 *
 * `onOrphaned` is invoked at most once.
 */
export function guardAgainstOrphaning(
  onOrphaned: () => void,
  options: OrphanGuardOptions = {}
): (() => void) | null {
  const readParentPid = options.readParentPid ?? (() => process.ppid);
  const isRelaunchedChild =
    options.isRelaunchedChild ??
    (() => Boolean(process.env[HEADLESS_RELAUNCH_ENV]));

  if (!isRelaunchedChild()) {
    return null;
  }

  const launcherPid = readParentPid();
  let fired = false;

  const timer = setInterval(() => {
    if (fired) {
      return;
    }
    // Comparing against the startup pid catches reparenting to init and to a
    // subreaper alike.
    if (readParentPid() !== launcherPid) {
      fired = true;
      clearInterval(timer);
      onOrphaned();
    }
  }, options.intervalMs ?? DEFAULT_INTERVAL_MS);

  // The HTTP server keeps serve mode alive; this watch must not.
  timer.unref();

  return () => clearInterval(timer);
}
