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

import { spawnSync, type SpawnSyncReturns } from 'child_process';
import { existsSync, realpathSync } from 'fs';
import { join, resolve } from 'path';

// Set on the re-execed child so it never loops.
const REEXEC_GUARD_ENV = 'SELF_REVIEW_REEXECED';

/**
 * Resolve the invoked path to an absolute file path, mirroring how the shell
 * found it.
 *
 * A path (absolute or relative) is resolved against the cwd. A *bare command
 * name* — what a shell passes as `argv[0]` after a `PATH` lookup, e.g. typing
 * `self-review` for the Homebrew symlink — is looked up on `PATH` the same way
 * the shell did. Without this, `realpath('self-review')` would resolve against
 * the cwd, throw, and the symlink launch would go undetected.
 *
 * @param invokedPath the path as invoked (`process.argv0`)
 * @param env         the process environment (for `PATH`)
 * @param fileExists  existence check, injectable for testing
 * @returns the absolute invoked path, or `null` if a bare name isn't on `PATH`
 */
export function resolveInvokedPath(
  invokedPath: string,
  env: NodeJS.ProcessEnv,
  fileExists: (p: string) => boolean = existsSync
): string | null {
  // Anything with a separator is a real path — resolve it against the cwd.
  if (invokedPath.includes('/')) return resolve(invokedPath);

  // A bare command name: walk PATH like the shell did to find the file.
  const dirs = (env.PATH ?? '').split(':').filter(Boolean);
  for (const dir of dirs) {
    const candidate = join(dir, invokedPath);
    if (fileExists(candidate)) return candidate;
  }
  return null;
}

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
 * @param fileExists  existence check for PATH lookup, injectable for testing
 */
export function resolveReexecTarget(
  platform: NodeJS.Platform,
  isPackaged: boolean,
  invokedPath: string,
  execPath: string,
  env: NodeJS.ProcessEnv,
  realpath: (p: string) => string = realpathSync,
  fileExists: (p: string) => boolean = existsSync
): string | null {
  if (platform !== 'darwin') return null;
  if (!isPackaged) return null;
  if (env[REEXEC_GUARD_ENV] === '1') return null;
  if (!invokedPath) return null;

  // Resolve a bare command name (`self-review`) against PATH the way the shell
  // did, so the Homebrew symlink launch is detected and not silently skipped.
  const invokedAbsolute = resolveInvokedPath(invokedPath, env, fileExists);
  if (!invokedAbsolute) return null;

  let realExec: string;
  let realInvoked: string;
  try {
    realExec = realpath(execPath);
    realInvoked = realpath(invokedAbsolute);
  } catch {
    // If either path can't be resolved, don't gamble on a re-exec.
    return null;
  }

  // Only act when the launch path is a *different* path that still resolves to
  // the real bundle binary — i.e. a symlink (or aliased path) to it. A direct
  // launch has `invokedAbsolute === realExec`, so it is left untouched.
  if (realInvoked !== realExec) return null;
  if (invokedAbsolute === realExec) return null;

  return realExec;
}

/**
 * Decide how the parent should exit after a re-exec, mirroring the child's
 * fate.
 *
 * `spawnSync` leaves `status` as `null` when the spawn *fails* (`error` set) or
 * the child is *killed by a signal* (`signal` set). Forwarding `status ?? 0` in
 * those cases would report a clean exit for a failed re-exec or a Ctrl+C, which
 * for a CLI-first app looks like a successful review. Instead: a spawn failure
 * exits non-zero, a signalled child is re-raised so the parent reflects it, and
 * otherwise the child's exit status is forwarded unchanged.
 *
 * @param result the `spawnSync` return value
 * @returns the signal to re-raise (or `null`) and the exit code to fall back to
 */
export function resolveReexecExit(
  result: Pick<SpawnSyncReturns<Buffer>, 'status' | 'signal' | 'error'>
): { signal: NodeJS.Signals | null; code: number } {
  if (result.error) return { signal: null, code: 1 };
  if (result.signal) return { signal: result.signal, code: 1 };
  return { signal: null, code: result.status ?? 1 };
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

  const { signal, code } = resolveReexecExit(result);
  if (signal) {
    // Re-raise so the parent's exit reflects the signal (e.g. Ctrl+C). Fall
    // through to exit() if a handler swallowed it.
    process.kill(process.pid, signal);
  }
  process.exit(code);
}
