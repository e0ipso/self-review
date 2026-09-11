/**
 * Run the built serve executable the way a person does: an ordinary child
 * process, in a working directory, writing its lines to stderr.
 *
 * Deliberately plain: an ordinary child of this process, in this process
 * group, with no re-exec and no watchdog. The plan names process detachment
 * in particular as evidence that serve mode has drifted back inside the
 * desktop binary, so the spawn options below are the whole story. The only
 * lifecycle this module knows is the one the program itself has: completing
 * the review writes the file and ends the process.
 */
import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

/** The built entry point, exactly what `bin.self-review-serve` points at. */
export const SERVE_CLI = path.resolve(__dirname, '../../packages/serve/dist/cli.js');

/** Where the URL line comes from — stderr, since stdout is unused. */
const READY_LINE = /Review ready at (http:\/\/127\.0\.0\.1:\d+\/?)/;

export interface ServeProcess {
  /** The served URL, as the program printed it. */
  url: string;
  /** Everything the program has written to stderr so far. */
  stderr(): string;
  /** Everything it has written to stdout, which should stay empty. */
  stdout(): string;
  /** Resolve with the exit code, or reject once `timeoutMs` has passed. */
  waitForExit(timeoutMs: number): Promise<number>;
  /** Whether the process has already ended. */
  hasExited(): boolean;
  /** Stop a process a failing test left running. */
  kill(): void;
}

/**
 * Start the executable and resolve once it has announced its URL.
 *
 * Rejects if it exits first: a startup error (nothing to review, an
 * unwritable output path) is reported on stderr and is far more useful than
 * the timeout it would otherwise become.
 */
export function startServe(args: string[], cwd: string, timeoutMs = 30_000): Promise<ServeProcess> {
  if (!existsSync(SERVE_CLI)) {
    throw new Error(
      `The serve executable is not built: ${SERVE_CLI}. ` +
        'Run `npm run build --workspace @self-review/serve` first.'
    );
  }

  const child: ChildProcess = spawn(process.execPath, [SERVE_CLI, ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  });

  let stderrText = '';
  let stdoutText = '';
  let exitCode: number | null = null;

  child.stdout?.on('data', (chunk: Buffer) => {
    stdoutText += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrText += chunk.toString();
  });

  const exited = new Promise<number>(resolve => {
    child.on('close', code => {
      exitCode = code ?? -1;
      resolve(exitCode);
    });
  });

  const handle: ServeProcess = {
    url: '',
    stderr: () => stderrText,
    stdout: () => stdoutText,
    hasExited: () => exitCode !== null,
    waitForExit: (ms: number) => waitForExit(exited, ms, () => stderrText),
    kill: () => {
      if (exitCode === null) child.kill();
    },
  };

  return new Promise<ServeProcess>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`serve did not print a URL within ${timeoutMs}ms.\n${stderrText}`));
    }, timeoutMs);

    const check = () => {
      const match = READY_LINE.exec(stderrText);
      if (!match) return;
      clearTimeout(timer);
      child.stderr?.off('data', check);
      handle.url = match[1];
      resolve(handle);
    };

    child.stderr?.on('data', check);
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    void exited.then(code => {
      if (handle.url) return;
      clearTimeout(timer);
      reject(new Error(`serve exited with code ${code} before serving.\n${stderrText}`));
    });
  });
}

function waitForExit(
  exited: Promise<number>,
  timeoutMs: number,
  stderrText: () => string
): Promise<number> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    exited,
    new Promise<number>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `serve was still running ${timeoutMs}ms after the review was ` +
                `completed.\n${stderrText()}`
            )
          ),
        timeoutMs
      );
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
