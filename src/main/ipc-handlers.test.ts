import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiffFile, DiffHunk, DiffLine, DiffLoadPayload } from '../shared/types';

// Mock electron before importing the module under test
const handlers: Record<string, (...args: unknown[]) => unknown> = {};
const onHandlers: Record<string, (...args: unknown[]) => unknown> = {};

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    }),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      onHandlers[channel] = handler;
    }),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showMessageBoxSync: vi.fn(),
  },
  app: {
    getPath: vi.fn(),
    getVersion: vi.fn(() => '9.9.9'),
  },
  shell: {
    openExternal: vi.fn(),
  },
}));

vi.mock('./app-assets', () => ({
  getAppIconDataUri: vi.fn(async () => 'data:image/png;base64,ICON'),
}));

vi.mock('./version-checker', () => ({
  getVersionUpdate: vi.fn(),
}));

vi.mock('../../packages/core/src/directory-scanner', () => ({
  scanDirectory: vi.fn(),
  scanFile: vi.fn(),
}));

vi.mock('../../packages/core/src/payload-sizing', () => ({
  computePayloadStats: vi.fn(),
  countTotalLines: vi.fn(),
}));

vi.mock('../../packages/core/src/git', () => ({
  runGitDiffAsync: vi.fn(),
  readGitBlobAsync: vi.fn(),
}));

import { BrowserWindow, dialog } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { registerIpcHandlers, setDiffData } from './ipc-handlers';

function makeLine(type: DiffLine['type'] = 'addition'): DiffLine {
  return { type, oldLineNumber: null, newLineNumber: 1, content: '+ hello' };
}

function makeHunk(): DiffHunk {
  return {
    header: '@@ -0,0 +1,1 @@',
    oldStart: 0,
    oldLines: 0,
    newStart: 1,
    newLines: 1,
    lines: [makeLine()],
  };
}

function makeFile(path: string): DiffFile {
  return {
    oldPath: '',
    newPath: path,
    changeType: 'added',
    isBinary: false,
    hunks: [makeHunk()],
  };
}

describe('ipc-handlers', () => {
  beforeEach(() => {
    // Clear handler registrations
    for (const key of Object.keys(handlers)) delete handlers[key];
    for (const key of Object.keys(onHandlers)) delete onHandlers[key];
    vi.clearAllMocks();
    registerIpcHandlers();
  });

  describe('DIFF_LOAD_FILE handler', () => {
    it('returns hunks for a known file', async () => {
      const file = makeFile('src/app.ts');
      const payload: DiffLoadPayload = {
        files: [file],
        source: { type: 'directory', sourcePath: '/tmp' },
      };
      setDiffData(payload);

      const handler = handlers[IPC.DIFF_LOAD_FILE];
      expect(handler).toBeDefined();

      const result = await handler({}, 'src/app.ts');
      expect(result).toEqual(file.hunks);
    });

    it('returns null when file not found', async () => {
      const payload: DiffLoadPayload = {
        files: [makeFile('src/app.ts')],
        source: { type: 'directory', sourcePath: '/tmp' },
      };
      setDiffData(payload);

      const handler = handlers[IPC.DIFF_LOAD_FILE];
      const result = await handler({}, 'src/nonexistent.ts');
      expect(result).toBeNull();
    });

    it('returns null when no cache', async () => {
      // The desktop session lives at module scope and setDiffData always
      // assigns, so an earlier test's payload is still there. The empty-session
      // branch itself is covered in review-handlers.test.ts; here, an empty
      // file list is the closest this registration can get.
      const payload: DiffLoadPayload = {
        files: [],
        source: { type: 'directory', sourcePath: '/tmp' },
      };
      setDiffData(payload);

      const handler = handlers[IPC.DIFF_LOAD_FILE];
      const result = await handler({}, 'any-file.ts');
      expect(result).toBeNull();
    });

    it('matches file by oldPath when newPath is empty', async () => {
      const file: DiffFile = {
        oldPath: 'src/deleted.ts',
        newPath: '',
        changeType: 'deleted',
        isBinary: false,
        hunks: [makeHunk()],
      };
      const payload: DiffLoadPayload = {
        files: [file],
        source: { type: 'directory', sourcePath: '/tmp' },
      };
      setDiffData(payload);

      const handler = handlers[IPC.DIFF_LOAD_FILE];
      const result = await handler({}, 'src/deleted.ts');
      expect(result).toEqual(file.hunks);
    });
  });

  describe('APP_GET_INFO handler', () => {
    it('returns the app version and icon data URI', async () => {
      const handler = handlers[IPC.APP_GET_INFO];
      expect(handler).toBeDefined();

      const result = await handler({});
      expect(result).toEqual({
        version: '9.9.9',
        iconDataUri: 'data:image/png;base64,ICON',
      });
    });
  });

  describe('DIFF_REQUEST handler (preparePayload)', () => {
    it('strips hunks and sets contentLoaded=false for large payloads', () => {
      const file = makeFile('src/app.ts');
      const payload: DiffLoadPayload = {
        files: [file],
        source: { type: 'directory', sourcePath: '/tmp' },
        isLargePayload: true,
      };
      setDiffData(payload);

      const mockSend = vi.fn();
      const handler = onHandlers[IPC.DIFF_REQUEST];
      handler({ sender: { send: mockSend } });

      expect(mockSend).toHaveBeenCalledWith(
        IPC.DIFF_LOAD,
        expect.objectContaining({
          isLargePayload: true,
          files: [
            expect.objectContaining({
              newPath: 'src/app.ts',
              hunks: [],
              contentLoaded: false,
            }),
          ],
        })
      );
    });

    it('sets contentLoaded=true for normal payloads', () => {
      const file = makeFile('src/app.ts');
      const payload: DiffLoadPayload = {
        files: [file],
        source: { type: 'directory', sourcePath: '/tmp' },
      };
      setDiffData(payload);

      const mockSend = vi.fn();
      const handler = onHandlers[IPC.DIFF_REQUEST];
      handler({ sender: { send: mockSend } });

      expect(mockSend).toHaveBeenCalledWith(
        IPC.DIFF_LOAD,
        expect.objectContaining({
          files: [
            expect.objectContaining({
              newPath: 'src/app.ts',
              hunks: file.hunks,
              contentLoaded: true,
            }),
          ],
        })
      );
    });
  });

  describe('DIFF_EXPAND_CONTEXT handler (repo path threading)', () => {
    it('runs git diff in the diff source repository, not the process cwd', async () => {
      const { runGitDiffAsync } = await import('../../packages/core/src/git');
      const gitMock = vi.mocked(runGitDiffAsync);
      gitMock.mockResolvedValue(
        [
          'diff --git a/src/app.ts b/src/app.ts',
          'index 0000000..1111111 100644',
          '--- a/src/app.ts',
          '+++ b/src/app.ts',
          '@@ -0,0 +1,1 @@',
          '+ hello',
          '',
        ].join('\n')
      );

      const payload: DiffLoadPayload = {
        files: [makeFile('src/app.ts')],
        source: {
          type: 'git',
          gitDiffArgs: 'aaa111...bbb222',
          repository: '/tmp/self-review-clone',
        },
      };
      setDiffData(payload);

      const handler = handlers[IPC.DIFF_EXPAND_CONTEXT];
      expect(handler).toBeDefined();
      const result = await handler({}, { filePath: 'src/app.ts', contextLines: 10 });

      expect(gitMock).toHaveBeenCalledWith(
        ['aaa111...bbb222', '-U10', '--', 'src/app.ts'],
        '/tmp/self-review-clone'
      );
      expect(result).toMatchObject({ hunks: expect.any(Array) });
    });
  });

  describe('DIFF_LOAD_IMAGE handler (repo path threading)', () => {
    it('resolves relative image paths against the git source repository', async () => {
      const os = await import('os');
      const fsMod = await import('fs');
      const pathMod = await import('path');
      const repoDir = fsMod.mkdtempSync(pathMod.join(os.tmpdir(), 'self-review-clone-'));
      try {
        // 1x1 transparent PNG
        const png = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          'base64'
        );
        fsMod.mkdirSync(pathMod.join(repoDir, 'assets'));
        fsMod.writeFileSync(pathMod.join(repoDir, 'assets', 'pic.png'), png);

        const payload: DiffLoadPayload = {
          files: [makeFile('assets/pic.png')],
          source: {
            type: 'git',
            gitDiffArgs: 'aaa111...bbb222',
            repository: repoDir,
          },
        };
        setDiffData(payload);

        const handler = handlers[IPC.DIFF_LOAD_IMAGE];
        const result = (await handler({}, 'assets/pic.png')) as {
          dataUri?: string;
          error?: string;
        };

        // The file only exists inside repoDir, never under process.cwd(),
        // so success proves resolution against the source repository.
        expect(result.error).toBeUndefined();
        expect(result.dataUri).toMatch(/^data:image\/png;base64,/);
      } finally {
        fsMod.rmSync(repoDir, { recursive: true, force: true });
      }
    });

    it('reads the blob at the reviewed head SHA in remote mode, not the working tree', async () => {
      const { readGitBlobAsync } = await import('../../packages/core/src/git');
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      );
      vi.mocked(readGitBlobAsync).mockResolvedValueOnce(png);

      const payload: DiffLoadPayload = {
        files: [makeFile('assets/pic.png')],
        source: {
          type: 'git',
          gitDiffArgs: 'aaa111...bbb222',
          repository: '/tmp/self-review-clone-does-not-exist',
        },
        remote: {
          remoteUrl: 'https://github.com/owner/repo/pull/42',
          remoteBaseSha: 'aaa111',
          remoteHeadSha: 'bbb222',
          remoteForge: 'github',
          threadSyncAvailable: true,
          temporaryClone: false,
        },
      };
      setDiffData(payload);

      const handler = handlers[IPC.DIFF_LOAD_IMAGE];
      const result = (await handler({}, 'assets/pic.png')) as {
        dataUri?: string;
        error?: string;
      };

      // A temp clone's working tree sits on the default branch, so the
      // blob must come from git at the fetched head SHA. The repository
      // path does not exist on disk, so success proves the git read.
      expect(readGitBlobAsync).toHaveBeenCalledWith(
        '/tmp/self-review-clone-does-not-exist',
        'bbb222:assets/pic.png'
      );
      expect(result.error).toBeUndefined();
      expect(result.dataUri).toMatch(/^data:image\/png;base64,/);
    });
  });
  // The apply write boundary, through the registrations that carry it. What
  // each handler decides is covered against fresh sessions in
  // packages/core/src/review-handlers.test.ts; what is covered here is that
  // the channels exist, reach the desktop session, and open the picker in
  // the main process rather than trusting a directory from the renderer.
  //
  // The desktop session lives at module scope and nothing clears the
  // destination once it is set, so the sequence below must run before any
  // other test in this file records one.
  describe('SUGGESTION_APPLY and SUGGESTION_CHOOSE_DESTINATION handlers', () => {
    function temporaryClonePayload(clonePath: string): DiffLoadPayload {
      return {
        files: [makeFile('src/app.ts')],
        source: { type: 'git', gitDiffArgs: 'aaa111...bbb222', repository: clonePath },
        remote: {
          remoteUrl: 'https://github.com/owner/repo/pull/42',
          remoteBaseSha: 'aaa111',
          remoteHeadSha: 'bbb222',
          remoteForge: 'github',
          threadSyncAvailable: true,
          temporaryClone: true,
        },
      };
    }

    const request = {
      filePath: 'src/app.ts',
      lineRange: { side: 'new', start: 2, end: 2 },
      suggestion: { originalCode: 'const b = 2;', proposedCode: 'const b = 20;' },
    };
    const ORIGINAL = 'const a = 1;\nconst b = 2;\nconst c = 3;\n';

    it('refuses, asks for a destination, then writes into the directory picked', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const os = await import('os');
      const fsMod = await import('fs');
      const pathMod = await import('path');
      const tmpRoot = fsMod.realpathSync(
        fsMod.mkdtempSync(pathMod.join(os.tmpdir(), 'self-review-apply-ipc-'))
      );
      try {
        const clonePath = pathMod.join(tmpRoot, 'clone');
        const destination = pathMod.join(tmpRoot, 'work');
        for (const root of [clonePath, destination]) {
          fsMod.mkdirSync(pathMod.join(root, 'src'), { recursive: true });
          fsMod.writeFileSync(pathMod.join(root, 'src', 'app.ts'), ORIGINAL);
        }
        setDiffData(temporaryClonePayload(clonePath));

        const apply = handlers[IPC.SUGGESTION_APPLY];
        const choose = handlers[IPC.SUGGESTION_CHOOSE_DESTINATION];
        expect(apply).toBeDefined();
        expect(choose).toBeDefined();

        // 1. Nothing picked yet, so the clone is not written into.
        expect(await apply({}, request)).toMatchObject({
          status: 'refused',
          reason: 'destination-required',
        });
        expect(fsMod.readFileSync(pathMod.join(clonePath, 'src', 'app.ts'), 'utf-8')).toBe(
          ORIGINAL
        );

        // 2. A dismissed picker changes nothing.
        vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] });
        expect(await choose({ sender: {} })).toEqual({ status: 'cancelled' });

        // 3. A directory inside the clone is refused however it was reached.
        vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
          canceled: false,
          filePaths: [pathMod.join(clonePath, 'src')],
        });
        expect(await choose({ sender: {} })).toMatchObject({
          status: 'rejected',
          reason: 'destination-inside-temporary-clone',
        });
        expect(await apply({}, request)).toMatchObject({
          status: 'refused',
          reason: 'destination-required',
        });

        // 4. A directory outside it is accepted, and the next apply lands there.
        vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
          canceled: false,
          filePaths: [destination],
        });
        expect(await choose({ sender: {} })).toEqual({
          status: 'chosen',
          destinationRoot: destination,
        });

        expect(await apply({}, request)).toEqual({
          status: 'applied',
          filePath: 'src/app.ts',
          replacedLines: 1,
        });
        expect(fsMod.readFileSync(pathMod.join(destination, 'src', 'app.ts'), 'utf-8')).toBe(
          'const a = 1;\nconst b = 20;\nconst c = 3;\n'
        );
        // The clone is still exactly as it was materialized.
        expect(fsMod.readFileSync(pathMod.join(clonePath, 'src', 'app.ts'), 'utf-8')).toBe(
          ORIGINAL
        );
      } finally {
        fsMod.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('opens a directory picker on the requesting window, or standalone without one', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const choose = handlers[IPC.SUGGESTION_CHOOSE_DESTINATION];
      const win = { id: 1 };
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValueOnce(
        win as unknown as ReturnType<typeof BrowserWindow.fromWebContents>
      );
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });

      await choose({ sender: {} });

      // showOpenDialog is overloaded on its first argument, so read the
      // recorded arguments positionally rather than through one signature.
      const calls = vi.mocked(dialog.showOpenDialog).mock.calls as unknown as unknown[][];
      const directoryPicker = { properties: ['openDirectory', 'createDirectory'] };
      expect(calls[0][0]).toBe(win);
      expect(calls[0][1]).toMatchObject(directoryPicker);

      // No owning window: the dialog is opened application-modal instead, and
      // the options must still be the first argument.
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValueOnce(null);
      await choose({ sender: {} });

      expect(calls[1][0]).toMatchObject(directoryPicker);
    });
  });
});
