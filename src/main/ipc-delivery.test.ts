import { expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { sendDiffLoad, sendGuideLoad, sendResumeLoad, sendConfigLoad } from './ipc-delivery';
import { MAX_CONTENT_TEXT_BYTES } from './content-budget';
import { IPC } from '../shared/ipc-channels';
import { DEFAULT_CONFIG } from '../../packages/react/src/config-defaults';

it.each(['diff', 'guide', 'resume', 'config'] as const)(
  'refuses oversized pushed %s before sending',
  kind => {
    const send = vi.fn();
    const window = { webContents: { send } } as unknown as BrowserWindow;
    const huge = 'x'.repeat(MAX_CONTENT_TEXT_BYTES / 2 + 1);
    expect(() => {
      if (kind === 'diff')
        sendDiffLoad(window, { source: { type: 'directory', sourcePath: huge }, files: [] });
      if (kind === 'guide') sendGuideLoad(window, { overview: huge, groups: [] });
      if (kind === 'resume') sendResumeLoad(window, { comments: [], viewedFiles: [huge] });
      if (kind === 'config') sendConfigLoad(window, { ...DEFAULT_CONFIG, ignore: [huge] });
    }).toThrow(/delivery limits/);
    expect(send).not.toHaveBeenCalled();
  }
);
it('sends a supported lazy projection without budgeting retained full hunks', () => {
  const send = vi.fn();
  const window = { webContents: { send } } as unknown as BrowserWindow;
  const hunks = [
    {
      header: 'x'.repeat(MAX_CONTENT_TEXT_BYTES / 2 + 1),
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 0,
      lines: [],
    },
  ];
  const payload = {
    source: { type: 'directory' as const, sourcePath: '/review' },
    isLargePayload: true,
    files: [{ oldPath: '', newPath: 'a.ts', changeType: 'added' as const, isBinary: false, hunks }],
  };
  sendDiffLoad(window, payload);
  expect(send).toHaveBeenCalledWith(
    IPC.DIFF_LOAD,
    expect.objectContaining({
      files: [expect.objectContaining({ hunks: [], contentLoaded: false })],
    })
  );
  expect(payload.files[0].hunks).toBe(hunks);
});

it('refuses undefined resume data rather than acknowledging an empty review', () => {
  const send = vi.fn();
  const window = { webContents: { send } } as unknown as BrowserWindow;
  expect(() => sendResumeLoad(window, undefined as never)).toThrow(/not acknowledge/);
  expect(send).not.toHaveBeenCalled();
});
