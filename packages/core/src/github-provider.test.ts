// github-provider.test.ts
// Tests for the gh-CLI-backed GitHub ForgeProvider: base-branch lookup,
// review-comment thread normalization, anchor mapping, and degradation when
// the gh CLI is absent or unauthenticated.

import { describe, it, expect } from 'vitest';
import {
  ForgeCliUnavailableError,
  type ForgeCommandResult,
  type ForgeCommandRunner,
  type ForgeUrl,
} from './forge-provider';
import { createGitHubProvider } from './github-provider';

const PR_URL: ForgeUrl = {
  forge: 'github',
  host: 'github.com',
  owner: 'e0ipso',
  repo: 'self-review',
  number: 42,
};

interface RecordedCall {
  command: string;
  args: string[];
}

function makeRunner(
  results: ForgeCommandResult[]
): { runner: ForgeCommandRunner; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const queue = [...results];
  const runner: ForgeCommandRunner = async (command, args) => {
    calls.push({ command, args });
    const next = queue.shift();
    if (!next) {
      throw new Error('mock runner exhausted');
    }
    return next;
  };
  return { runner, calls };
}

function ok(stdout: string): ForgeCommandResult {
  return { stdout, stderr: '', exitCode: 0 };
}

// Realistic (trimmed) shapes from `gh api repos/.../pulls/N/comments`.
// `gh api --paginate --slurp` wraps the pages in an outer array.
function slurpPages(...pages: unknown[][]): string {
  return JSON.stringify(pages);
}

const SINGLE_COMMENT = {
  id: 1001,
  in_reply_to_id: undefined,
  user: { login: 'alice' },
  body: 'Consider renaming this variable.',
  path: 'src/main/cli.ts',
  side: 'RIGHT',
  start_side: null,
  line: 12,
  start_line: null,
  original_line: 12,
  original_start_line: null,
};

const REPLY_CHAIN = [
  {
    id: 2001,
    user: { login: 'alice' },
    body: 'Root question about this branch.',
    path: 'src/main/git.ts',
    side: 'RIGHT',
    start_side: null,
    line: 30,
    start_line: null,
    original_line: 30,
    original_start_line: null,
  },
  {
    id: 2002,
    in_reply_to_id: 2001,
    user: { login: 'bob' },
    body: 'First reply.',
    path: 'src/main/git.ts',
    side: 'RIGHT',
    start_side: null,
    line: 30,
    start_line: null,
    original_line: 30,
    original_start_line: null,
  },
  {
    id: 2003,
    in_reply_to_id: 2001,
    user: { login: 'alice' },
    body: 'Second reply.',
    path: 'src/main/git.ts',
    side: 'RIGHT',
    start_side: null,
    line: 30,
    start_line: null,
    original_line: 30,
    original_start_line: null,
  },
];

const RANGE_COMMENT = {
  id: 3001,
  user: { login: 'carol' },
  body: 'This whole block can be simplified.',
  path: 'src/renderer/App.tsx',
  side: 'RIGHT',
  start_side: 'RIGHT',
  line: 58,
  start_line: 50,
  original_line: 58,
  original_start_line: 50,
};

const OLD_SIDE_COMMENT = {
  id: 4001,
  user: { login: 'dave' },
  body: 'Why was this deleted?',
  path: 'src/main/config.ts',
  side: 'LEFT',
  start_side: null,
  line: 7,
  start_line: null,
  original_line: 7,
  original_start_line: null,
};

const OUTDATED_COMMENT = {
  id: 5001,
  user: { login: 'erin' },
  body: 'This anchor no longer applies to the head diff.',
  path: 'src/main/main.ts',
  side: 'RIGHT',
  start_side: null,
  line: null,
  start_line: null,
  original_line: 21,
  original_start_line: null,
};

describe('createGitHubProvider', () => {
  it('exposes the github forge name', () => {
    const { runner } = makeRunner([]);
    expect(createGitHubProvider(runner).forge).toBe('github');
  });

  describe('fetchBaseBranch', () => {
    it('returns the base branch via gh pr view --json baseRefName', async () => {
      const { runner, calls } = makeRunner([
        ok(JSON.stringify({ baseRefName: 'main' })),
      ]);
      const provider = createGitHubProvider(runner);

      await expect(provider.fetchBaseBranch(PR_URL)).resolves.toBe('main');

      expect(calls).toHaveLength(1);
      expect(calls[0].command).toBe('gh');
      expect(calls[0].args).toEqual([
        'pr',
        'view',
        '42',
        '--repo',
        'github.com/e0ipso/self-review',
        '--json',
        'baseRefName',
      ]);
    });

    it('passes the URL host verbatim for enterprise hosts with a port', async () => {
      const { runner, calls } = makeRunner([
        ok(JSON.stringify({ baseRefName: 'develop' })),
      ]);
      const provider = createGitHubProvider(runner);

      await expect(
        provider.fetchBaseBranch({
          ...PR_URL,
          host: 'github.example.com:8443',
          owner: 'org',
          repo: 'repo',
          number: 7,
        })
      ).resolves.toBe('develop');

      expect(calls[0].args).toContain('github.example.com:8443/org/repo');
    });

    it('throws ForgeCliUnavailableError when gh cannot be spawned', async () => {
      const runner: ForgeCommandRunner = async () => {
        throw Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });
      };
      const provider = createGitHubProvider(runner);

      const error = await provider.fetchBaseBranch(PR_URL).catch(e => e);
      expect(error).toBeInstanceOf(ForgeCliUnavailableError);
      expect(error.forge).toBe('github');
      expect(error.cli).toBe('gh');
      expect(error.message).toContain('ENOENT');
    });

    it('throws ForgeCliUnavailableError with stderr on non-zero exit', async () => {
      const { runner } = makeRunner([
        {
          stdout: '',
          stderr: 'gh: To get started with GitHub CLI, please run: gh auth login',
          exitCode: 4,
        },
      ]);
      const provider = createGitHubProvider(runner);

      const error = await provider.fetchBaseBranch(PR_URL).catch(e => e);
      expect(error).toBeInstanceOf(ForgeCliUnavailableError);
      expect(error.message).toContain('gh auth login');
    });

    it('throws ForgeCliUnavailableError on unparseable gh output', async () => {
      const { runner } = makeRunner([ok('not json')]);
      const provider = createGitHubProvider(runner);

      await expect(provider.fetchBaseBranch(PR_URL)).rejects.toBeInstanceOf(
        ForgeCliUnavailableError
      );
    });
  });

  describe('fetchThreads', () => {
    it('fetches review comments via gh api --paginate --slurp with the URL host', async () => {
      const { runner, calls } = makeRunner([ok(slurpPages([]))]);
      const provider = createGitHubProvider(runner);

      await expect(provider.fetchThreads(PR_URL)).resolves.toEqual([]);

      expect(calls).toHaveLength(1);
      expect(calls[0].command).toBe('gh');
      expect(calls[0].args).toEqual([
        'api',
        'repos/e0ipso/self-review/pulls/42/comments',
        '--hostname',
        'github.com',
        '--paginate',
        '--slurp',
      ]);
    });

    it('normalizes a single-comment thread', async () => {
      const { runner } = makeRunner([ok(slurpPages([SINGLE_COMMENT]))]);
      const provider = createGitHubProvider(runner);

      const threads = await provider.fetchThreads(PR_URL);

      expect(threads).toEqual([
        {
          root: {
            remoteId: '1001',
            author: 'alice',
            body: 'Consider renaming this variable.',
          },
          replies: [],
          anchor: {
            filePath: 'src/main/cli.ts',
            side: 'new',
            startLine: 12,
            endLine: 12,
            outdated: false,
          },
        },
      ]);
    });

    it('groups a reply chain into one thread preserving document order', async () => {
      const { runner } = makeRunner([ok(slurpPages(REPLY_CHAIN))]);
      const provider = createGitHubProvider(runner);

      const threads = await provider.fetchThreads(PR_URL);

      expect(threads).toHaveLength(1);
      expect(threads[0].root.remoteId).toBe('2001');
      expect(threads[0].replies.map(r => r.remoteId)).toEqual(['2002', '2003']);
      expect(threads[0].replies.map(r => r.author)).toEqual(['bob', 'alice']);
    });

    it('attaches a reply targeting a non-root member to the same thread', async () => {
      const chained = [
        REPLY_CHAIN[0],
        REPLY_CHAIN[1],
        { ...REPLY_CHAIN[2], in_reply_to_id: 2002 },
      ];
      const { runner } = makeRunner([ok(slurpPages(chained))]);
      const provider = createGitHubProvider(runner);

      const threads = await provider.fetchThreads(PR_URL);

      expect(threads).toHaveLength(1);
      expect(threads[0].replies.map(r => r.remoteId)).toEqual(['2002', '2003']);
    });

    it('normalizes a multi-line range comment', async () => {
      const { runner } = makeRunner([ok(slurpPages([RANGE_COMMENT]))]);
      const provider = createGitHubProvider(runner);

      const [thread] = await provider.fetchThreads(PR_URL);

      expect(thread.anchor).toEqual({
        filePath: 'src/renderer/App.tsx',
        side: 'new',
        startLine: 50,
        endLine: 58,
        outdated: false,
      });
    });

    it('normalizes an old-side (deleted line) comment', async () => {
      const { runner } = makeRunner([ok(slurpPages([OLD_SIDE_COMMENT]))]);
      const provider = createGitHubProvider(runner);

      const [thread] = await provider.fetchThreads(PR_URL);

      expect(thread.anchor).toEqual({
        filePath: 'src/main/config.ts',
        side: 'old',
        startLine: 7,
        endLine: 7,
        outdated: false,
      });
    });

    it('flags outdated anchors and keeps the historic lines', async () => {
      const { runner } = makeRunner([ok(slurpPages([OUTDATED_COMMENT]))]);
      const provider = createGitHubProvider(runner);

      const [thread] = await provider.fetchThreads(PR_URL);

      expect(thread.anchor).toEqual({
        filePath: 'src/main/main.ts',
        side: 'new',
        startLine: 21,
        endLine: 21,
        outdated: true,
      });
    });

    it('flattens multiple paginated pages in order', async () => {
      const { runner } = makeRunner([
        ok(slurpPages([SINGLE_COMMENT], [RANGE_COMMENT])),
      ]);
      const provider = createGitHubProvider(runner);

      const threads = await provider.fetchThreads(PR_URL);

      expect(threads.map(t => t.root.remoteId)).toEqual(['1001', '3001']);
    });

    it('treats an orphan reply (unknown parent) as its own thread root', async () => {
      const orphan = { ...REPLY_CHAIN[1], in_reply_to_id: 9999 };
      const { runner } = makeRunner([ok(slurpPages([orphan]))]);
      const provider = createGitHubProvider(runner);

      const threads = await provider.fetchThreads(PR_URL);

      expect(threads).toHaveLength(1);
      expect(threads[0].root.remoteId).toBe('2002');
      expect(threads[0].replies).toEqual([]);
    });

    it('attributes comments from deleted users to ghost', async () => {
      const { runner } = makeRunner([
        ok(slurpPages([{ ...SINGLE_COMMENT, user: null }])),
      ]);
      const provider = createGitHubProvider(runner);

      const [thread] = await provider.fetchThreads(PR_URL);

      expect(thread.root.author).toBe('ghost');
    });

    it('throws ForgeCliUnavailableError when gh cannot be spawned', async () => {
      const runner: ForgeCommandRunner = async () => {
        throw Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });
      };
      const provider = createGitHubProvider(runner);

      await expect(provider.fetchThreads(PR_URL)).rejects.toBeInstanceOf(
        ForgeCliUnavailableError
      );
    });

    it('throws ForgeCliUnavailableError on non-zero exit (auth failure)', async () => {
      const { runner } = makeRunner([
        { stdout: '', stderr: 'HTTP 401: Bad credentials', exitCode: 1 },
      ]);
      const provider = createGitHubProvider(runner);

      const error = await provider.fetchThreads(PR_URL).catch(e => e);
      expect(error).toBeInstanceOf(ForgeCliUnavailableError);
      expect(error.message).toContain('Bad credentials');
    });
  });
});
