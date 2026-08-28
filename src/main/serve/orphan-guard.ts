// src/main/serve/orphan-guard.ts
// Shuts serve mode down when the launcher that spawned it dies.
//
// On Linux, `--serve` re-launches itself once with `--ozone-platform=headless`
// (see relaunchHeadless in main.ts) and the launcher then blocks in spawnSync
// waiting for that child. The launcher is what the reviewer actually invoked,
// so its lifetime is the session's lifetime.
//
// Signals to the launcher's *process group* already reach the child, so Ctrl-C
// in a terminal works and needs nothing from this module. The gap is the
// launcher dying without passing anything on — SIGKILL, an OOM kill, a crash.
// The child is then reparented to init and keeps holding the port, and because
// SIGKILL cannot be handled there is no fix available on the launcher side.
//
// So the child watches instead: if its parent changes, the launcher is gone and
// the child exits. Only the relaunched child does this. A directly-invoked
// serve process is left alone, because there the parent is the reviewer's shell
// and outliving it (nohup, a detached session) is legitimate.

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
    // A changed parent means the original one is gone: on Linux an orphan is
    // reparented to init (1) or to a subreaper, so comparing against the pid
    // recorded at startup catches both without assuming which.
    if (readParentPid() !== launcherPid) {
      fired = true;
      clearInterval(timer);
      onOrphaned();
    }
  }, options.intervalMs ?? DEFAULT_INTERVAL_MS);

  // Never hold the process open on this timer's account — the HTTP server is
  // what keeps serve mode alive, and this watch must not extend that by a tick.
  timer.unref();

  return () => clearInterval(timer);
}
