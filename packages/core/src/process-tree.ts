// POSIX process ownership for bounded commands. Keep the controlling terminal: discover
// descendants by parent PID instead of putting the command in a detached process group.
import { execFile, type ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

interface ProcessIdentity {
  pid: number;
  parent: number;
  state: string;
  birth: string;
}

async function snapshot(): Promise<ProcessIdentity[]> {
  const output = await new Promise<string>((resolve, reject) => {
    execFile(
      'ps',
      ['-axo', 'pid=,ppid=,stat=,lstart='],
      { encoding: 'utf8', timeout: 1_000, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout))
    );
  });
  return output.split('\n').flatMap(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
    return match
      ? [{ pid: Number(match[1]), parent: Number(match[2]), state: match[3], birth: match[4] }]
      : [];
  });
}

// Linux's start ticks distinguish PID reuse even within one second. macOS ps supplies
// the process start date; retain it and drop identities as soon as they disappear.
async function linuxBirth(pid: number): Promise<string> {
  const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
  return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
}

/**
 * Freeze the parent before discovering its children, then freeze each discovered generation.
 * This closes the fork-during-traversal window without severing terminal credential prompts.
 * TERM gets a grace period; KILL and exit observation also have a bounded deadline.
 */
export async function terminateProcessTree(child: ChildProcess, graceMs: number): Promise<void> {
  if (child.pid === undefined) return;
  child.kill('SIGSTOP');
  const owned = new Map<number, ProcessIdentity>();
  const births = new Map<number, string>();
  const signal = async (entry: ProcessIdentity, name: NodeJS.Signals) => {
    try {
      if (process.platform === 'linux' && (await linuxBirth(entry.pid)) !== births.get(entry.pid)) {
        owned.delete(entry.pid);
        return;
      }
      if (process.platform !== 'linux') {
        const current = (await snapshot()).find(process => process.pid === entry.pid);
        if (!current || current.birth !== entry.birth || current.state.startsWith('Z')) {
          owned.delete(entry.pid);
          return;
        }
      }
      process.kill(entry.pid, name);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== 'ESRCH' &&
        (error as NodeJS.ErrnoException).code !== 'ENOENT'
      )
        throw error;
      owned.delete(entry.pid);
    }
  };
  try {
    const discoveryDeadline = Date.now() + 2_000;
    while (true) {
      const processes = await snapshot();
      const added: ProcessIdentity[] = [];
      for (const entry of processes) {
        if (owned.has(entry.pid)) continue;
        if (entry.pid !== child.pid && !owned.has(entry.parent)) continue;
        if (entry.state.startsWith('Z')) continue;
        if (process.platform === 'linux') {
          try {
            births.set(entry.pid, await linuxBirth(entry.pid));
          } catch {
            continue;
          } // Exited before discovery; it cannot receive a signal.
        }
        owned.set(entry.pid, entry);
        added.push(entry);
        await signal(entry, 'SIGSTOP');
      }
      if (added.length === 0) break;
      if (Date.now() >= discoveryDeadline) throw new Error('Process tree discovery timed out');
    }

    // Leaves first gives parents a chance to reap their children before they exit.
    for (const entry of [...owned.values()].reverse()) await signal(entry, 'SIGTERM');
    for (const entry of [...owned.values()].reverse()) await signal(entry, 'SIGCONT');
    const killAt = Date.now() + graceMs;
    const deadline = killAt + 2_000;
    while (owned.size > 0) {
      const current = new Map((await snapshot()).map(entry => [entry.pid, entry]));
      for (const entry of owned.values()) {
        const live = current.get(entry.pid);
        if (!live || live.birth !== entry.birth || live.state.startsWith('Z')) {
          owned.delete(entry.pid);
        } else if (Date.now() >= killAt) {
          await signal(entry, 'SIGKILL');
        }
      }
      if (owned.size === 0) return;
      if (Date.now() >= deadline) throw new Error('Command process tree did not terminate');
      await delay(25);
    }
  } finally {
    // Also unfreeze/terminate the direct child if discovery itself failed.
    child.kill('SIGKILL');
    for (const entry of owned.values()) await signal(entry, 'SIGKILL');
  }
}
