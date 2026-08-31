/**
 * Booting and observing a real `self-review serve` session.
 *
 * Serve mode is a foreground CLI command, not a library: it resolves the diff,
 * prints one URL on stdout, and exits when the review is written. So this
 * helper does what a reviewer's terminal does — spawn the packaged binary,
 * read the URL it prints, and watch for the process to end — rather than
 * importing the bootstrap and calling it in-process. Importing it would prove
 * the routes work while proving nothing about the command.
 *
 * It mirrors `tests/webapp-steps/app.ts` in shape: start a server, hand back an
 * address, tear it down afterwards. The differences are forced by what is being
 * started — an Electron binary rather than Vite, addressed on an
 * OS-assigned port rather than a fixed one.
 */
import { spawn, execFileSync, type ChildProcess } from 'child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

/** The fixture's only file, and the only line that differs from HEAD. */
export const FIXTURE_FILE = 'greeter.js';
/** New-side line number of the changed line. The comment is anchored here. */
export const FIXTURE_CHANGED_LINE = 2;
/** Text present only in the post-change version of that line. */
export const FIXTURE_NEW_TEXT = 'Howdy';
/** Text present only in the pre-change version of that line. */
export const FIXTURE_OLD_TEXT = 'Hello';

/**
 * A git repository with exactly one modified line.
 *
 * Deliberately minimal: the assertions below are about the loop, and a diff
 * with one hunk means a failure names the one line it could possibly be about.
 * Caller owns cleanup — see {@link removeServeRepo}.
 */
export function createServeRepo(): string {
  const repoDir = mkdtempSync(join(tmpdir(), 'self-review-serve-'));
  const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: repoDir, stdio: 'pipe' });
  };

  git('init');
  git('config', 'user.email', 'test@test.com');
  git('config', 'user.name', 'Test');

  const before = [
    'export function greet(name) {',
    `  return '${FIXTURE_OLD_TEXT}, ' + name;`,
    '}',
    '',
  ].join('\n');
  writeFileSync(join(repoDir, FIXTURE_FILE), before);
  git('add', '-A');
  git('commit', '-m', 'Initial commit');

  const after = before.replace(FIXTURE_OLD_TEXT, FIXTURE_NEW_TEXT);
  writeFileSync(join(repoDir, FIXTURE_FILE), after);

  return repoDir;
}

export function removeServeRepo(repoDir: string): void {
  rmSync(repoDir, { recursive: true, force: true });
}

/**
 * Path to the binary `npm run package` produces.
 *
 * The packaged build is used rather than the Electron binary plus the webpack
 * bundle, because the built browser client only reaches its resolved location
 * (`<resources>/serve-client`) when the packager copies it there. Running from
 * source would need `SELF_REVIEW_CLIENT_DIR` to be set, which would make the
 * test pass over a path no reviewer ever takes.
 */
export function packagedBinaryPath(): string {
  const outDir = resolve(
    __dirname,
    '../../out',
    `Self Review-${process.platform}-${process.arch}`
  );
  const binary =
    process.platform === 'darwin'
      ? join(outDir, 'Self Review.app', 'Contents', 'MacOS', 'Self Review')
      : join(
          outDir,
          process.platform === 'win32' ? 'self-review.exe' : 'self-review'
        );

  if (!existsSync(binary)) {
    throw new Error(
      `The packaged binary is missing: ${binary}\n` +
        'Run `npm run package` first (the `test:e2e:serve` script does).'
    );
  }
  return binary;
}

/** A running `serve` process, with everything the test needs to observe it. */
export interface ServeSession {
  /** Base URL the server printed on stdout, e.g. `http://127.0.0.1:41787/`. */
  url: string;
  /** Absolute path the review XML will be written to. */
  outputPath: string;
  /** The repository the diff was taken from. */
  repoDir: string;
  /** Exit code once the process has ended, or null while it is still running. */
  exitCode(): number | null;
  /** Resolves with the exit code, or rejects if the process outlives the wait. */
  waitForExit(timeoutMs: number): Promise<number>;
  /** Everything the process wrote to stderr, for failure messages. */
  stderr(): string;
  /** Kill the process if it is still running. Safe to call more than once. */
  dispose(): Promise<void>;
}

/**
 * Start serve mode against `repoDir` and wait until it is accepting requests.
 *
 * Port 0 lets the OS choose, so concurrent runs cannot collide and nothing has
 * to be reaped from a previous one; the bound port is read back from the URL
 * the command prints, which is the same contract a reviewer relies on.
 */
export async function startServeSession(
  repoDir: string,
  timeoutMs = 60_000
): Promise<ServeSession> {
  const outputPath = join(repoDir, 'review.xml');

  // DISPLAY is removed rather than left alone because a stale value — an Xvfb
  // an earlier suite started, say — is worse than none: Electron would try it
  // and fail, where absent it takes the headless path serve mode relaunches
  // itself into.
  const env = { ...process.env };
  delete env.DISPLAY;

  // `detached` puts the command in its own process group, which is what makes
  // {@link ServeSession.dispose} able to clean up after a *failing* test. On
  // Linux the binary relaunches itself headless and waits on that child, so the
  // process this handle refers to is only the launcher: signalling it alone
  // leaves the grandchild holding the port, reparented to init. Signalling the
  // group reaches both. A passing test never needs this — serve mode exits on
  // its own once the review is written.
  const child = spawn(
    packagedBinaryPath(),
    ['serve', '--address=127.0.0.1:0', `--output=${outputPath}`],
    { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'], env, detached: true }
  );

  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  let exitCode: number | null = null;
  const exited = new Promise<number>(resolveExit => {
    child.on('close', code => {
      exitCode = code ?? -1;
      resolveExit(exitCode);
    });
  });

  const url = await waitForUrl(
    child,
    () => stdout,
    () => stderr,
    exited,
    timeoutMs
  );

  return {
    url,
    outputPath,
    repoDir,
    exitCode: () => exitCode,
    waitForExit: (waitMs: number) =>
      withTimeout(
        exited,
        waitMs,
        () =>
          `The serve process did not exit within ${waitMs}ms. stderr:\n${tail(stderr)}`
      ),
    stderr: () => stderr,
    dispose: async () => {
      if (exitCode !== null) return;
      // Addressed by process group id, never by a name or command-line
      // pattern: this process tree contains the string "self-review" and so
      // does the test runner's own, so a `pkill -f` here would take the runner
      // with it.
      signalGroup(child, 'SIGTERM');
      await withTimeout(exited, 10_000, () => 'timeout').catch(() => {
        signalGroup(child, 'SIGKILL');
      });
    },
  };
}

/**
 * Signal the whole process group the command was spawned into.
 *
 * A negative pid means "the group" to `kill(2)`, which is the only way to
 * reach the headless process the launcher relaunched itself as.
 */
function signalGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    // Already gone, or the group outlived its leader — nothing to signal.
  }
}

/** The URL is the command's product and the only thing it puts on stdout. */
function waitForUrl(
  child: ChildProcess,
  getStdout: () => string,
  getStderr: () => string,
  exited: Promise<number>,
  timeoutMs: number
): Promise<string> {
  return new Promise<string>((resolveUrl, rejectUrl) => {
    const settle = (): void => {
      clearInterval(poll);
      clearTimeout(timer);
    };

    const poll = setInterval(() => {
      const match = getStdout().match(/^(http:\/\/\S+)$/m);
      if (match) {
        settle();
        resolveUrl(match[1]);
      }
    }, 50);

    const timer = setTimeout(() => {
      settle();
      signalGroup(child, 'SIGKILL');
      rejectUrl(
        new Error(
          `Serve mode printed no URL within ${timeoutMs}ms. stderr:\n${tail(getStderr())}`
        )
      );
    }, timeoutMs);

    void exited.then(code => {
      // Exiting before it printed a URL means startup refused — surface its
      // own message rather than a timeout that says nothing.
      if (getStdout().match(/^(http:\/\/\S+)$/m)) return;
      settle();
      rejectUrl(
        new Error(
          `Serve mode exited with code ${code} before printing a URL. stderr:\n${tail(getStderr())}`
        )
      );
    });
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: () => string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, rejectRace) => {
      timer = setTimeout(() => rejectRace(new Error(message())), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Electron's GPU/dbus noise dwarfs the serve log; keep the recent end of it. */
function tail(text: string, lines = 20): string {
  return text.split('\n').slice(-lines).join('\n');
}
