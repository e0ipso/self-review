import { realpath, stat } from 'fs/promises';
import type { IpcMainInvokeEvent } from 'electron';
import type { ReviewTransition } from './review-transition';

interface Selection {
  path: string;
  canonicalPath: string;
  device: number;
  inode: number;
  assertCurrent: () => void;
}

/** Only native picker results authorize a source, and only while their welcome and frame survive. */
export class DirectorySelection {
  private selection: Selection | null = null;
  private choosing = false;
  constructor(
    private readonly transition: ReviewTransition,
    private readonly capturePeer: (event: IpcMainInvokeEvent) => () => void,
    private readonly pick: (event: IpcMainInvokeEvent) => Promise<string | null>
  ) {}

  async choose(event: IpcMainInvokeEvent): Promise<string | null> {
    const peer = this.capturePeer(event);
    const welcome = this.transition.capture();
    if (this.choosing) throw new Error('A directory picker is already open.');
    this.choosing = true;
    try {
      this.selection = null;
      const path = await this.pick(event);
      peer();
      welcome();
      if (path === null) return null;
      const canonicalPath = await realpath(path);
      const info = await stat(canonicalPath);
      peer();
      welcome();
      if (!info.isDirectory()) throw new Error('Choose a directory to review.');
      this.selection = {
        path,
        canonicalPath,
        device: info.dev,
        inode: info.ino,
        assertCurrent: () => {
          peer();
          welcome();
        },
      };
      return path;
    } finally {
      this.choosing = false;
    }
  }

  async authorize(event: IpcMainInvokeEvent, path: string): Promise<string> {
    this.capturePeer(event)();
    const selected = this.selection;
    if (!selected || selected.path !== path)
      throw new Error('Choose the review directory using Browse first.');
    selected.assertCurrent();
    const canonicalPath = await realpath(selected.canonicalPath);
    const info = await stat(canonicalPath);
    selected.assertCurrent();
    if (
      selected !== this.selection ||
      canonicalPath !== selected.canonicalPath ||
      !info.isDirectory() ||
      info.dev !== selected.device ||
      info.ino !== selected.inode
    )
      throw new Error('The selected directory has changed. Choose it again.');
    return canonicalPath;
  }
}
