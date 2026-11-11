// Shared bounded process execution. Resources belong to one call; cancellation settles only
// after its child has exited. Text adapters and binary blob reads share the same lifetime.
import { spawn } from 'child_process';
import { CommandCancelledError } from './forge-provider';
import type {
  CommandCancelReason,
  ForgeCommandOptions,
  ForgeCommandRunner,
} from './forge-provider';

export interface BufferedCommandResult {
  stdout: Buffer;
  stderr: Buffer;
  exitCode: number;
}

/** Same completion, interruption and output-bound contract as ForgeCommandRunner, with raw bytes. */
export type BufferedCommandRunner = (
  command: string,
  args: string[],
  options?: ForgeCommandOptions
) => Promise<BufferedCommandResult>;

const KILL_GRACE_MS = 2_000;
const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

export class CommandOutputLimitError extends Error {
  readonly code = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
  constructor(command: string, maxBytes: number) {
    super(`${command} produced more than ${maxBytes} bytes`);
    this.name = 'CommandOutputLimitError';
  }
}

// Explicit repository targets outrank the surrounding hook's repository location. Keep
// credential/configuration variables and GIT_INDEX_FILE, which can intentionally select
// the index used by a partial commit.
function repositoryEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_PREFIX']) delete env[key];
  return env;
}

/**
 * Default runner: spawns the real binary. Rejects on spawn failure, on output over
 * the buffer cap, and with {@link CommandCancelledError} on abort or timeout (SIGTERM,
 * then SIGKILL after {@link KILL_GRACE_MS}; settles once the child exited).
 *
 * Deliberately not in its own process group: that would detach the controlling
 * terminal and silently disable git's and ssh's credential prompts.
 */
export const runBufferedCommand: BufferedCommandRunner = (command, args, options = {}) =>
  new Promise<BufferedCommandResult>((resolve, reject) => {
    const { signal, timeoutMs } = options;
    if (signal?.aborted) {
      reject(new CommandCancelledError('aborted', command, args));
      return;
    }

    const maxOutputBytes = options.maxOutputBytes ?? MAX_OUTPUT_BYTES;
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 0) {
      reject(new RangeError('maxOutputBytes must be a nonnegative safe integer'));
      return;
    }
    if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs < 0)) {
      reject(new RangeError('timeoutMs must be a nonnegative finite number'));
      return;
    }
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: options.cwd,
      env:
        command === 'git' && (options.cwd !== undefined || args.includes('-C'))
          ? repositoryEnvironment()
          : undefined,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    let cancelled: CommandCancelReason | null = null;
    let overflowed = false;
    let killTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;

    const killChild = () => {
      if (killTimer !== undefined) return;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, KILL_GRACE_MS);
    };
    const cancel = (reason: CommandCancelReason) => {
      if (settled || cancelled !== null) return;
      cancelled = reason;
      killChild();
    };
    const onAbort = () => cancel('aborted');
    signal?.addEventListener('abort', onAbort, { once: true });
    if (timeoutMs !== undefined && timeoutMs > 0) {
      timeoutTimer = setTimeout(() => cancel('timeout'), timeoutMs);
    }

    const settle = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      if (killTimer) clearTimeout(killTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      signal?.removeEventListener('abort', onAbort);
      outcome();
    };

    const collect = (sink: Buffer[]) => (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        if (!overflowed) {
          overflowed = true;
          killChild();
        }
        return;
      }
      sink.push(chunk);
    };
    child.stdout?.on('data', collect(stdout));
    child.stderr?.on('data', collect(stderr));

    child.on('error', error => settle(() => reject(error)));

    // A helper (ssh waiting on the terminal) may hold our pipes; closing them lets `close` follow
    // `exit`.
    child.on('exit', () => {
      if (cancelled !== null || overflowed) {
        child.stdout?.destroy();
        child.stderr?.destroy();
      }
    });

    child.on('close', (code, exitSignal) =>
      settle(() => {
        if (cancelled !== null) {
          reject(new CommandCancelledError(cancelled, command, args));
          return;
        }
        if (overflowed) {
          reject(new CommandOutputLimitError(command, maxOutputBytes));
          return;
        }
        let stderrBytes = Buffer.concat(stderr);
        if (code === null && exitSignal) {
          const separator =
            stderrBytes.length === 0 || stderrBytes[stderrBytes.length - 1] === 10 ? '' : '\n';
          stderrBytes = Buffer.concat([
            stderrBytes,
            Buffer.from(`${separator}(killed by ${exitSignal})\n`),
          ]);
        }
        resolve({
          stdout: Buffer.concat(stdout),
          stderr: stderrBytes,
          exitCode: code ?? 1,
        });
      })
    );
  });

/** Text view for forge commands and diff metadata. The byte limit is applied before decoding. */
export const defaultGitRunner: ForgeCommandRunner = async (command, args, options) => {
  const result = await runBufferedCommand(command, args, options);
  return {
    stdout: result.stdout.toString('utf-8'),
    stderr: result.stderr.toString('utf-8'),
    exitCode: result.exitCode,
  };
};
