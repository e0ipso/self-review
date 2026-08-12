// src/main/relaunch-guard.ts
//
// macOS symlink-launch safeguard.
//
// Electron locates its `Frameworks/` directory — and therefore its helper
// apps (GPU/Renderer/Network/Plugin) — *relative to the executable path as it
// was launched*, and macOS does not resolve symlinks in that path. When the
// app is started through a symlink that points at the in-bundle binary
// (e.g. the `self-review` command a Homebrew cask drops in
// `/opt/homebrew/bin`, or any hand-made symlink), Electron looks for
// `<symlink dir>/../Frameworks` instead of the one inside `Self Review.app`.
// If a `Frameworks` directory happens to exist next to the symlink — Homebrew
// ships one under its prefix for Python, GTK, etc. — Electron finds the wrong
// one and every child process dies with:
//
//   FATAL:electron_main_delegate_mac.mm:65] Unable to find helper app
//
// The fix is to re-exec from the *real* bundle binary before Electron spawns
// any helper, so native path resolution stays inside the `.app`.

import { spawnSync } from 'child_process';
import { realpathSync } from 'fs';
import { resolve } from 'path';

// Set on the re-execed child so it never loops.
const REEXEC_GUARD_ENV = 'SELF_REVIEW_REEXECED';

/**
 * Decide whether the process must re-exec from its real bundle path.
 *
 * Returns the real executable path to re-exec from, or `null` when the current
 * launch is already safe: non-macOS, unpackaged/dev, already re-execed, the
 * launch path can't be resolved, or the app was launched directly from the
 * real binary (Finder, `open`, an absolute real path).
 *
 * Pure and fully injectable so it can be unit-tested without a real bundle.
 *
 * @param platform    `process.platform`
 * @param isPackaged  `app.isPackaged` — dev launches never need this
 * @param invokedPath the path as invoked (`process.argv0`), symlink-preserving
 * @param execPath    the resolved executable (`process.execPath`)
 * @param env         the process environment (for the re-exec guard)
 * @param realpath    symlink resolver, injectable for testing
 */
export function resolveReexecTarget(
  platform: NodeJS.Platform,
  isPackaged: boolean,
  invokedPath: string,
  execPath: string,
  env: NodeJS.ProcessEnv,
  realpath: (p: string) => string = realpathSync
): string | null {
  if (platform !== 'darwin') return null;
  if (!isPackaged) return null;
  if (env[REEXEC_GUARD_ENV] === '1') return null;
  if (!invokedPath) return null;

  let realExec: string;
  let realInvoked: string;
  try {
    realExec = realpath(execPath);
    realInvoked = realpath(invokedPath);
  } catch {
    // If either path can't be resolved, don't gamble on a re-exec.
    return null;
  }

  // Only act when the launch path is a *different* path that still resolves to
  // the real bundle binary — i.e. a symlink (or aliased path) to it. A direct
  // launch has `resolve(invokedPath) === realExec`, so it is left untouched.
  if (realInvoked !== realExec) return null;
  if (resolve(invokedPath) === realExec) return null;

  return realExec;
}

/**
 * If launched via a symlink on macOS, re-exec from the real bundle binary and
 * exit with the child's status. No-op on safe launches.
 *
 * MUST run before `app.whenReady()`, i.e. before Electron spawns any helper
 * process — otherwise the crash has already happened. `spawnSync` with
 * inherited stdio preserves the blocking, terminal-attached behaviour of the
 * original launch and forwards the exit code unchanged.
 *
 * @param isPackaged `app.isPackaged`
 */
export function reexecFromRealPathIfNeeded(isPackaged: boolean): void {
  const target = resolveReexecTarget(
    process.platform,
    isPackaged,
    process.argv0,
    process.execPath,
    process.env
  );
  if (!target) return;

  const result = spawnSync(target, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, [REEXEC_GUARD_ENV]: '1' },
  });
  process.exit(result.status ?? 0);
}
