import { mkdtemp, mkdir, rm, symlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { it, expect, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { DirectorySelection } from './directory-selection';
import { ReviewTransition } from './review-transition';
import { createReviewSession } from '../../packages/core/src/review-handlers';

it('authorizes only the native canonical directory, retains retry, and rejects changed sessions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'picked-source-'));
  try {
    const target = join(root, 'target');
    const alias = join(root, 'alias');
    await mkdir(target);
    await symlink(target, alias);
    const session = createReviewSession();
    session.diffData = { files: [], source: { type: 'welcome' } };
    const transition = new ReviewTransition(session);
    const pick = vi.fn(async () => alias);
    const peer = {} as IpcMainInvokeEvent;
    const selection = new DirectorySelection(transition, () => () => {}, pick);
    await expect(selection.authorize(peer, target)).rejects.toThrow(/Browse/);
    expect(await selection.choose(peer)).toBe(alias);
    await expect(selection.authorize(peer, target)).rejects.toThrow(/Browse/);
    expect(await selection.authorize(peer, alias)).toBe(target);
    expect(await selection.authorize(peer, alias)).toBe(target);
    session.diffData = { files: [], source: { type: 'welcome' } };
    await expect(selection.authorize(peer, alias)).rejects.toThrow(/session/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects picker completions after remote start or window/frame loss', async () => {
  for (const cause of ['session', 'peer']) {
    const session = createReviewSession();
    session.diffData = { files: [], source: { type: 'welcome' } };
    let complete!: (path: string | null) => void;
    let live = true;
    const selection = new DirectorySelection(
      new ReviewTransition(session),
      () => () => {
        if (!live) throw new Error('closed');
      },
      () =>
        new Promise(resolve => {
          complete = resolve;
        })
    );
    const choosing = selection.choose({} as IpcMainInvokeEvent);
    const rejected = expect(choosing).rejects.toThrow();
    if (cause === 'session')
      session.diffData = { files: [], source: { type: 'directory', sourcePath: '/' } };
    else live = false;
    complete('/does-not-need-to-exist');
    await rejected;
  }
});
