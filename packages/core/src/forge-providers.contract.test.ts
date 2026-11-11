import { describe, expect, it } from 'vitest';
import { createGitHubProvider } from './github-provider';
import { createGitLabProvider } from './gitlab-provider';
import {
  CommandCancelledError,
  ForgeCliUnavailableError,
  type ForgeCommandRunner,
  type ForgeName,
  type ForgeUrl,
} from './forge-provider';
import { mapThreadsToReviewComments } from './thread-mapper';

const comment = {
  id: 1,
  user: { login: 'alice' },
  body: '反馈 ][ café\n```suggestion\nx\n```',
  path: 'src/über.ts',
  line: 3,
  side: 'RIGHT',
};
const note = {
  id: 1,
  author: { username: 'alice' },
  body: comment.body,
  position: { new_path: comment.path, new_line: 3, head_sha: 'a'.repeat(40) },
};

function harness(forge: ForgeName, outputs: string[]) {
  const queue = [...outputs];
  const calls: string[][] = [];
  // Real runners complete asynchronously and reject an interrupted call, never return a partial page.
  const runner: ForgeCommandRunner = async (_command, args) => {
    await Promise.resolve();
    calls.push(args);
    const stdout = queue.shift();
    if (stdout === undefined) throw new Error('runner result queue exhausted');
    return { stdout, stderr: '', exitCode: 0 };
  };
  const provider = forge === 'github' ? createGitHubProvider(runner) : createGitLabProvider(runner);
  const url: ForgeUrl = { forge, host: 'forge.example', owner: 'org', repo: 'repo', number: 1 };
  return { provider, url, calls };
}

function page(forge: ForgeName, entries: unknown[]): string {
  return JSON.stringify(forge === 'github' ? [entries] : entries);
}
function entry(forge: ForgeName, turn: unknown): unknown {
  return forge === 'github' ? turn : { id: 'discussion', notes: [turn] };
}

for (const forge of ['github', 'gitlab'] as const) {
  describe(`${forge} provider response contract`, () => {
    it.each([null, false, 1, 'unexpected', [], {}, { wrong_branch: 'main' }])(
      'rejects malformed base response %j with a typed failure',
      async payload => {
        const { provider, url } = harness(forge, [JSON.stringify(payload)]);
        await expect(provider.fetchBaseBranch(url)).rejects.toBeInstanceOf(
          ForgeCliUnavailableError
        );
      }
    );

    it.each(['null', '{}', '42', '"unexpected"', '', 'truncated [', '[] trailing-junk'])(
      'rejects malformed thread output %j with a typed failure',
      async stdout => {
        const { provider, url } = harness(forge, [stdout]);
        await expect(provider.fetchThreads(url)).rejects.toBeInstanceOf(ForgeCliUnavailableError);
      }
    );

    it('rejects a bad page after a valid page instead of returning a partial success', async () => {
      const stdout = forge === 'github' ? '[[], {}]' : '[]\n{}';
      const { provider, url } = harness(forge, [stdout]);
      await expect(provider.fetchThreads(url)).rejects.toBeInstanceOf(ForgeCliUnavailableError);
    });

    it.each([null, false, [], {}, { id: {} }, { id: 1, body: 4 }])(
      'rejects malformed nested feedback %j with a typed failure',
      async value => {
        const { provider, url } = harness(forge, [page(forge, [entry(forge, value)])]);
        await expect(provider.fetchThreads(url)).rejects.toBeInstanceOf(ForgeCliUnavailableError);
      }
    );

    it.each(['body', 'author', 'anchor'] as const)(
      'validates nested %s data before mapping',
      async field => {
        const value = forge === 'github' ? { ...comment } : { ...note };
        const invalid =
          field === 'body'
            ? { ...value, body: { secret: 'private payload' } }
            : field === 'author'
              ? forge === 'github'
                ? { ...value, user: { login: 9 } }
                : { ...value, author: { username: 9 } }
              : forge === 'github'
                ? { ...value, line: '3' }
                : { ...value, position: { new_path: 4 } };
        const { provider, url } = harness(forge, [page(forge, [entry(forge, invalid)])]);
        const error = await provider.fetchThreads(url).catch(error => error);
        expect(error).toBeInstanceOf(ForgeCliUnavailableError);
        expect(error.message).not.toContain('private payload');
      }
    );

    it('keeps empty pages, extension fields, null authors, Unicode and reply order', async () => {
      const root =
        forge === 'github'
          ? { ...comment, user: null, extension: { ignored: true } }
          : { ...note, author: null, extension: { ignored: true } };
      const turns =
        forge === 'github'
          ? [
              root,
              { ...comment, id: 2, in_reply_to_id: 1 },
              { ...comment, id: 3, in_reply_to_id: 2 },
            ]
          : [root, { ...note, id: 2 }, { ...note, id: 3 }];
      const stdout =
        forge === 'github'
          ? JSON.stringify([[], turns, []])
          : `[]\n${JSON.stringify([{ id: 'd', notes: turns, future: 7 }])}\n[]`;
      const { provider, url } = harness(forge, [stdout]);
      const threads = await provider.fetchThreads(url);
      expect(threads).toHaveLength(1);
      expect(threads[0].root.body).toBe(comment.body);
      expect(threads[0].root.author).toBe(forge === 'github' ? 'ghost' : 'unknown');
      expect(threads[0].replies.map(turn => turn.remoteId)).toEqual(['2', '3']);
      expect(threads[0].anchor?.filePath).toBe(comment.path);
    });

    it('preserves a large paginated response without dropping or reordering feedback', async () => {
      const body = 'café 反馈 '.repeat(100);
      const entries = Array.from({ length: 1200 }, (_, index) =>
        forge === 'github'
          ? { ...comment, id: index + 1, body }
          : { id: `d-${index}`, notes: [{ ...note, id: index + 1, body }] }
      );
      const pages = [entries.slice(0, 400), entries.slice(400, 800), entries.slice(800)];
      const stdout =
        forge === 'github'
          ? JSON.stringify(pages)
          : pages.map(page => JSON.stringify(page)).join('\n');
      const { provider, url } = harness(forge, [stdout]);
      const threads = await provider.fetchThreads(url);
      expect(threads).toHaveLength(1200);
      expect(
        threads.every(
          (thread, index) => thread.root.remoteId === String(index + 1) && thread.root.body === body
        )
      ).toBe(true);
    });

    it('returns a successful empty list only from a valid empty response', async () => {
      const { provider, url } = harness(forge, [page(forge, [])]);
      await expect(provider.fetchThreads(url)).resolves.toEqual([]);
    });

    it.each([0, -1, 1.5])(
      'keeps feedback at file level for unusable numeric anchor %s',
      async line => {
        const value =
          forge === 'github'
            ? { ...comment, line }
            : { ...note, position: { ...note.position, new_line: line } };
        const { provider, url } = harness(forge, [page(forge, [entry(forge, value)])]);
        const threads = await provider.fetchThreads(url);
        expect(threads[0].anchor).toMatchObject({
          filePath: comment.path,
          startLine: null,
          endLine: null,
        });
        const [mapped] = mapThreadsToReviewComments(threads, [], 'a'.repeat(40));
        expect(mapped.body).toBe(comment.body);
        expect(mapped.lineRange).toBeNull();
        expect(mapped.suggestion).toBeNull();
      }
    );

    for (const reason of ['aborted', 'timeout'] as const) {
      it(`preserves ${reason} from an asynchronous runner in both methods`, async () => {
        const error = new CommandCancelledError(reason, forge === 'github' ? 'gh' : 'glab', []);
        const runner: ForgeCommandRunner = async () => {
          await Promise.resolve();
          throw error;
        };
        const provider =
          forge === 'github' ? createGitHubProvider(runner) : createGitLabProvider(runner);
        const { url } = harness(forge, []);
        await expect(provider.fetchBaseBranch(url)).rejects.toBe(error);
        await expect(provider.fetchThreads(url)).rejects.toBe(error);
      });
    }
  });
}

describe('provider-specific nested boundaries', () => {
  it.each([{}, null, undefined, 'wrong', [null], [{ bad: 'id' }]].map(notes => [notes]))(
    'rejects GitLab discussions without valid notes: %j',
    async notes => {
      const { provider, url } = harness('gitlab', [JSON.stringify([{ id: 'd', notes }])]);
      await expect(provider.fetchThreads(url)).rejects.toBeInstanceOf(ForgeCliUnavailableError);
    }
  );

  it.each([
    { line_range: [] },
    { line_range: { start: 1 } },
    { line_range: { end: { new_line: '3' } } },
    { head_sha: [] },
  ])('rejects malformed nested GitLab positions %j', async invalid => {
    const value = { ...note, position: { ...note.position, ...invalid } };
    const { provider, url } = harness('gitlab', [page('gitlab', [entry('gitlab', value)])]);
    await expect(provider.fetchThreads(url)).rejects.toBeInstanceOf(ForgeCliUnavailableError);
  });

  it.each(['{}', '[]', 'null', '{"headRefOid":42}'])(
    'keeps GitHub feedback visible when optional head proof is invalid: %s',
    async head => {
      const { provider, url, calls } = harness('github', [head, page('github', [comment]), head]);
      const [thread] = await provider.fetchThreads(url, { reviewedHeadSha: 'a'.repeat(40) });
      expect(thread.root.body).toBe(comment.body);
      expect(thread.anchor?.outdated).toBe(true);
      expect(thread.anchor?.headSha).toBeUndefined();
      expect(calls).toHaveLength(3);
    }
  );

  it('keeps GitHub feedback at file level for a future anchor side', async () => {
    const { provider, url } = harness('github', [page('github', [{ ...comment, side: 'FUTURE' }])]);
    const [thread] = await provider.fetchThreads(url);
    expect(thread.root.body).toBe(comment.body);
    expect(thread.anchor).toMatchObject({ startLine: null, endLine: null });
  });
});
