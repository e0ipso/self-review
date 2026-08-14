// gitlab-provider.test.ts
// Fixture-based tests for the glab-backed GitLab ForgeProvider. No real glab
// calls: the command runner is injected and returns canned JSON.

import { describe, it, expect, vi } from 'vitest';
import {
  ForgeCliUnavailableError,
  type ForgeCommandResult,
  type ForgeCommandRunner,
  type ForgeUrl,
} from './forge-provider';
import { createGitLabProvider } from './gitlab-provider';

interface GitLabNoteFixture {
  id: number;
  body: string;
  author: { username: string } | null;
  system: boolean;
  resolvable: boolean;
  resolved: boolean;
  position: Record<string, unknown> | null;
}

function makeNote(overrides: Partial<GitLabNoteFixture> = {}): GitLabNoteFixture {
  return {
    id: 1001,
    body: 'A note body',
    author: { username: 'alice' },
    system: false,
    resolvable: true,
    resolved: false,
    position: null,
    ...overrides,
  };
}

function makeDiscussion(
  notes: GitLabNoteFixture[],
  id = 'disc-1'
): { id: string; individual_note: boolean; notes: GitLabNoteFixture[] } {
  return { id, individual_note: false, notes };
}

const newLinePosition = {
  position_type: 'text',
  old_path: 'src/app.ts',
  new_path: 'src/app.ts',
  old_line: null,
  new_line: 42,
  line_range: null,
};

const oldLinePosition = {
  position_type: 'text',
  old_path: 'src/removed.ts',
  new_path: 'src/renamed.ts',
  old_line: 17,
  new_line: null,
  line_range: null,
};

const mrUrl: ForgeUrl = {
  forge: 'gitlab',
  host: 'gitlab.com',
  owner: 'e0ipso',
  repo: 'self-review',
  number: 12,
};

function jsonResult(payload: unknown): ForgeCommandResult {
  return { stdout: JSON.stringify(payload), stderr: '', exitCode: 0 };
}

/** Runner returning one canned result per call, recording invocations. */
function makeRunner(results: ForgeCommandResult[]): {
  runner: ForgeCommandRunner;
  calls: Array<{ command: string; args: string[] }>;
} {
  const calls: Array<{ command: string; args: string[] }> = [];
  let index = 0;
  const runner: ForgeCommandRunner = (command, args) => {
    calls.push({ command, args });
    const result = results[Math.min(index, results.length - 1)];
    index += 1;
    return Promise.resolve(result);
  };
  return { runner, calls };
}

describe('createGitLabProvider', () => {
  it('reports the gitlab forge name', () => {
    const { runner } = makeRunner([jsonResult([])]);
    expect(createGitLabProvider(runner).forge).toBe('gitlab');
  });

  describe('fetchBaseBranch', () => {
    it('returns the MR target branch from the glab api MR lookup', async () => {
      const { runner, calls } = makeRunner([jsonResult({ target_branch: 'main' })]);
      const provider = createGitLabProvider(runner);

      await expect(provider.fetchBaseBranch(mrUrl)).resolves.toBe('main');
      expect(calls).toHaveLength(1);
      expect(calls[0].command).toBe('glab');
      expect(calls[0].args).toEqual([
        'api',
        'projects/e0ipso%2Fself-review/merge_requests/12',
        '--hostname',
        'gitlab.com',
      ]);
    });

    it('URL-encodes subgroup slashes in the project path and passes the URL host', async () => {
      const { runner, calls } = makeRunner([jsonResult({ target_branch: 'develop' })]);
      const provider = createGitLabProvider(runner);
      const subgroupUrl: ForgeUrl = {
        forge: 'gitlab',
        host: 'git.example.com:8443',
        owner: 'group/subgroup',
        repo: 'repo',
        number: 5,
      };

      await expect(provider.fetchBaseBranch(subgroupUrl)).resolves.toBe('develop');
      expect(calls[0].args).toEqual([
        'api',
        'projects/group%2Fsubgroup%2Frepo/merge_requests/5',
        '--hostname',
        'git.example.com:8443',
      ]);
    });

    it('throws ForgeCliUnavailableError when the MR payload has no target branch', async () => {
      const { runner } = makeRunner([jsonResult({ iid: 12 })]);
      const provider = createGitLabProvider(runner);

      await expect(provider.fetchBaseBranch(mrUrl)).rejects.toBeInstanceOf(
        ForgeCliUnavailableError
      );
    });
  });

  describe('fetchThreads', () => {
    it('requests paginated discussions for the encoded project path', async () => {
      const { runner, calls } = makeRunner([jsonResult([])]);
      const provider = createGitLabProvider(runner);

      await expect(provider.fetchThreads(mrUrl)).resolves.toEqual([]);
      expect(calls[0].command).toBe('glab');
      expect(calls[0].args).toEqual([
        'api',
        'projects/e0ipso%2Fself-review/merge_requests/12/discussions',
        '--hostname',
        'gitlab.com',
        '--paginate',
      ]);
    });

    it('normalizes an unresolved single-note diff discussion', async () => {
      const discussion = makeDiscussion([
        makeNote({ id: 2001, body: 'Looks off', position: newLinePosition }),
      ]);
      const { runner } = makeRunner([jsonResult([discussion])]);
      const provider = createGitLabProvider(runner);

      const threads = await provider.fetchThreads(mrUrl);
      expect(threads).toEqual([
        {
          root: { remoteId: '2001', author: 'alice', body: 'Looks off' },
          replies: [],
          anchor: {
            filePath: 'src/app.ts',
            side: 'new',
            startLine: 42,
            endLine: 42,
            outdated: false,
          },
        },
      ]);
    });

    it('keeps the first note as root and subsequent notes as ordered replies', async () => {
      const discussion = makeDiscussion([
        makeNote({ id: 1, body: 'root', author: { username: 'alice' }, position: newLinePosition }),
        makeNote({ id: 2, body: 'first reply', author: { username: 'bob' } }),
        makeNote({ id: 3, body: 'second reply', author: { username: 'alice' } }),
      ]);
      const { runner } = makeRunner([jsonResult([discussion])]);
      const provider = createGitLabProvider(runner);

      const threads = await provider.fetchThreads(mrUrl);
      expect(threads).toHaveLength(1);
      expect(threads[0].root).toEqual({ remoteId: '1', author: 'alice', body: 'root' });
      expect(threads[0].replies).toEqual([
        { remoteId: '2', author: 'bob', body: 'first reply' },
        { remoteId: '3', author: 'alice', body: 'second reply' },
      ]);
    });

    it('drops system notes entirely, even mid-thread', async () => {
      const discussion = makeDiscussion([
        makeNote({ id: 1, body: 'root', position: newLinePosition }),
        makeNote({ id: 2, body: 'changed this line in version 2', system: true }),
        makeNote({ id: 3, body: 'real reply', author: { username: 'bob' } }),
      ]);
      const systemOnly = makeDiscussion(
        [makeNote({ id: 9, body: 'marked as draft', system: true, resolvable: false })],
        'disc-sys'
      );
      const { runner } = makeRunner([jsonResult([discussion, systemOnly])]);
      const provider = createGitLabProvider(runner);

      const threads = await provider.fetchThreads(mrUrl);
      expect(threads).toHaveLength(1);
      expect(threads[0].replies).toEqual([{ remoteId: '3', author: 'bob', body: 'real reply' }]);
    });

    it('excludes resolved discussions by default and includes them with includeResolved', async () => {
      const resolved = makeDiscussion(
        [
          makeNote({ id: 1, body: 'fixed already', resolved: true, position: newLinePosition }),
          makeNote({ id: 2, body: 'agreed', resolved: true }),
        ],
        'disc-resolved'
      );
      const open = makeDiscussion(
        [makeNote({ id: 3, body: 'still open', position: newLinePosition })],
        'disc-open'
      );
      const payload = jsonResult([resolved, open]);
      const { runner } = makeRunner([payload, payload]);
      const provider = createGitLabProvider(runner);

      const defaultThreads = await provider.fetchThreads(mrUrl);
      expect(defaultThreads.map((t) => t.root.remoteId)).toEqual(['3']);

      const allThreads = await provider.fetchThreads(mrUrl, { includeResolved: true });
      expect(allThreads.map((t) => t.root.remoteId)).toEqual(['1', '3']);
    });

    it('treats a partially resolved discussion as unresolved', async () => {
      const discussion = makeDiscussion([
        makeNote({ id: 1, body: 'root', resolved: true, position: newLinePosition }),
        makeNote({ id: 2, body: 'still discussing', resolved: false }),
      ]);
      const { runner } = makeRunner([jsonResult([discussion])]);
      const provider = createGitLabProvider(runner);

      await expect(provider.fetchThreads(mrUrl)).resolves.toHaveLength(1);
    });

    it('anchors old-side positions to the old path with side old', async () => {
      const discussion = makeDiscussion([
        makeNote({ id: 1, body: 'why delete this?', position: oldLinePosition }),
      ]);
      const { runner } = makeRunner([jsonResult([discussion])]);
      const provider = createGitLabProvider(runner);

      const threads = await provider.fetchThreads(mrUrl);
      expect(threads[0].anchor).toEqual({
        filePath: 'src/removed.ts',
        side: 'old',
        startLine: 17,
        endLine: 17,
        outdated: false,
      });
    });

    it('maps a multi-line line_range to start and end lines on the anchor side', async () => {
      const discussion = makeDiscussion([
        makeNote({
          id: 1,
          body: 'this whole block',
          position: {
            ...newLinePosition,
            new_line: 45,
            line_range: {
              start: { old_line: null, new_line: 40, type: 'new' },
              end: { old_line: null, new_line: 45, type: 'new' },
            },
          },
        }),
      ]);
      const { runner } = makeRunner([jsonResult([discussion])]);
      const provider = createGitLabProvider(runner);

      const threads = await provider.fetchThreads(mrUrl);
      expect(threads[0].anchor).toEqual({
        filePath: 'src/app.ts',
        side: 'new',
        startLine: 40,
        endLine: 45,
        outdated: false,
      });
    });

    it('maps an old-side line_range using the old lines of each edge', async () => {
      const discussion = makeDiscussion([
        makeNote({
          id: 1,
          body: 'removed block',
          position: {
            ...oldLinePosition,
            old_line: 20,
            line_range: {
              start: { old_line: 17, new_line: null, type: 'old' },
              end: { old_line: 20, new_line: null, type: 'old' },
            },
          },
        }),
      ]);
      const { runner } = makeRunner([jsonResult([discussion])]);
      const provider = createGitLabProvider(runner);

      const threads = await provider.fetchThreads(mrUrl);
      expect(threads[0].anchor).toEqual({
        filePath: 'src/removed.ts',
        side: 'old',
        startLine: 17,
        endLine: 20,
        outdated: false,
      });
    });

    it('returns a null anchor for a positionless (non-diff) discussion', async () => {
      const discussion = makeDiscussion([
        makeNote({ id: 1, body: 'general remark', resolvable: false, position: null }),
      ]);
      const { runner } = makeRunner([jsonResult([discussion])]);
      const provider = createGitLabProvider(runner);

      const threads = await provider.fetchThreads(mrUrl);
      expect(threads[0].anchor).toBeNull();
    });

    it('anchors a position with a path but no lines as file-level (null lines, side new)', async () => {
      const discussion = makeDiscussion([
        makeNote({
          id: 1,
          body: 'file-level note',
          position: {
            position_type: 'file',
            old_path: 'logo.png',
            new_path: 'logo.png',
            old_line: null,
            new_line: null,
            line_range: null,
          },
        }),
      ]);
      const { runner } = makeRunner([jsonResult([discussion])]);
      const provider = createGitLabProvider(runner);

      const threads = await provider.fetchThreads(mrUrl);
      expect(threads[0].anchor).toEqual({
        filePath: 'logo.png',
        side: 'new',
        startLine: null,
        endLine: null,
        outdated: false,
      });
    });

    it('falls back to unknown when a note has no author', async () => {
      const discussion = makeDiscussion([
        makeNote({ id: 1, body: 'ghost note', author: null, position: newLinePosition }),
      ]);
      const { runner } = makeRunner([jsonResult([discussion])]);
      const provider = createGitLabProvider(runner);

      const threads = await provider.fetchThreads(mrUrl);
      expect(threads[0].root.author).toBe('unknown');
    });

    it('flattens concatenated per-page arrays emitted by --paginate', async () => {
      const pageOne = [makeDiscussion([makeNote({ id: 1, body: 'a][b tricky' })], 'd1')];
      const pageTwo = [makeDiscussion([makeNote({ id: 2, body: 'page two' })], 'd2')];
      const stdout = `${JSON.stringify(pageOne)}\n${JSON.stringify(pageTwo)}`;
      const { runner } = makeRunner([{ stdout, stderr: '', exitCode: 0 }]);
      const provider = createGitLabProvider(runner);

      const threads = await provider.fetchThreads(mrUrl);
      expect(threads.map((t) => t.root.remoteId)).toEqual(['1', '2']);
    });
  });

  describe('glab unavailability', () => {
    it('throws ForgeCliUnavailableError when glab cannot be spawned (ENOENT)', async () => {
      const runner: ForgeCommandRunner = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('spawn glab ENOENT'), { code: 'ENOENT' }));
      const provider = createGitLabProvider(runner);

      const error = await provider.fetchThreads(mrUrl).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ForgeCliUnavailableError);
      expect((error as ForgeCliUnavailableError).forge).toBe('gitlab');
      expect((error as ForgeCliUnavailableError).cli).toBe('glab');
      expect((error as ForgeCliUnavailableError).message).toContain('ENOENT');
    });

    it('throws ForgeCliUnavailableError carrying stderr on non-zero exit (unauthenticated)', async () => {
      const { runner } = makeRunner([
        { stdout: '', stderr: 'glab: Not authenticated. Run `glab auth login`.', exitCode: 1 },
      ]);
      const provider = createGitLabProvider(runner);

      const error = await provider.fetchBaseBranch(mrUrl).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ForgeCliUnavailableError);
      expect((error as ForgeCliUnavailableError).message).toContain('Not authenticated');
    });

    it('throws ForgeCliUnavailableError on unparseable glab output', async () => {
      const { runner } = makeRunner([{ stdout: 'not json at all', stderr: '', exitCode: 0 }]);
      const provider = createGitLabProvider(runner);

      await expect(provider.fetchThreads(mrUrl)).rejects.toBeInstanceOf(ForgeCliUnavailableError);
    });
  });
});
