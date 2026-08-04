// forge-provider.test.ts
// Tests for forge URL parsing and the ForgeProvider contracts

import { describe, it, expect } from 'vitest';
import {
  parseForgeUrl,
  ForgeCliUnavailableError,
  type ForgeProvider,
  type ForgeThread,
  type ForgeUrl,
} from './forge-provider';

describe('parseForgeUrl', () => {
  describe('GitHub pull request URLs', () => {
    it('parses a github.com PR URL', () => {
      expect(parseForgeUrl('https://github.com/e0ipso/self-review/pull/126')).toEqual({
        forge: 'github',
        host: 'github.com',
        owner: 'e0ipso',
        repo: 'self-review',
        number: 126,
      });
    });

    it('parses a PR URL on any host by path shape alone', () => {
      expect(parseForgeUrl('https://github.example.com/org/repo/pull/7')).toEqual({
        forge: 'github',
        host: 'github.example.com',
        owner: 'org',
        repo: 'repo',
        number: 7,
      });
    });

    it('parses a PR URL with a trailing slash', () => {
      expect(parseForgeUrl('https://github.com/e0ipso/self-review/pull/126/')).toMatchObject({
        forge: 'github',
        number: 126,
      });
    });

    it('parses a PR URL with a query string and fragment', () => {
      expect(
        parseForgeUrl('https://github.com/e0ipso/self-review/pull/126?diff=split#discussion_r1')
      ).toMatchObject({
        forge: 'github',
        owner: 'e0ipso',
        repo: 'self-review',
        number: 126,
      });
    });

    it('parses a PR sub-page URL (files tab) to the same PR', () => {
      expect(parseForgeUrl('https://github.com/e0ipso/self-review/pull/126/files')).toMatchObject({
        forge: 'github',
        number: 126,
      });
    });
  });

  describe('GitLab merge request URLs', () => {
    it('parses a gitlab.com MR URL', () => {
      expect(parseForgeUrl('https://gitlab.com/gitlab-org/gitlab/-/merge_requests/12345')).toEqual({
        forge: 'gitlab',
        host: 'gitlab.com',
        owner: 'gitlab-org',
        repo: 'gitlab',
        number: 12345,
      });
    });

    it('parses a self-hosted GitLab MR URL (git.drupalcode.org)', () => {
      expect(parseForgeUrl('https://git.drupalcode.org/project/drupal/-/merge_requests/42')).toEqual({
        forge: 'gitlab',
        host: 'git.drupalcode.org',
        owner: 'project',
        repo: 'drupal',
        number: 42,
      });
    });

    it('parses a subgroup MR URL with the full namespace path as owner', () => {
      expect(
        parseForgeUrl('https://gitlab.com/group/subgroup/project/-/merge_requests/5')
      ).toEqual({
        forge: 'gitlab',
        host: 'gitlab.com',
        owner: 'group/subgroup',
        repo: 'project',
        number: 5,
      });
    });

    it('parses an MR URL with a trailing slash and query string', () => {
      expect(
        parseForgeUrl('https://gitlab.com/group/project/-/merge_requests/9/?tab=overview')
      ).toMatchObject({
        forge: 'gitlab',
        owner: 'group',
        repo: 'project',
        number: 9,
      });
    });
  });

  describe('non-forge URLs', () => {
    it('rejects a plain repository URL', () => {
      expect(parseForgeUrl('https://github.com/e0ipso/self-review')).toBeNull();
      expect(parseForgeUrl('https://gitlab.com/group/project')).toBeNull();
    });

    it('rejects issue URLs', () => {
      expect(parseForgeUrl('https://github.com/e0ipso/self-review/issues/5')).toBeNull();
      expect(parseForgeUrl('https://gitlab.com/group/project/-/issues/5')).toBeNull();
    });

    it('rejects an arbitrary non-URL string', () => {
      expect(parseForgeUrl('not a url at all')).toBeNull();
      expect(parseForgeUrl('')).toBeNull();
    });

    it('rejects non-http(s) schemes', () => {
      expect(parseForgeUrl('file:///owner/repo/pull/3')).toBeNull();
      expect(parseForgeUrl('ssh://git@github.com/owner/repo/pull/3')).toBeNull();
    });

    it('rejects URLs whose number segment is not numeric', () => {
      expect(parseForgeUrl('https://github.com/owner/repo/pull/abc')).toBeNull();
      expect(parseForgeUrl('https://gitlab.com/group/project/-/merge_requests/abc')).toBeNull();
    });

    it('rejects a pull path without owner and repo segments', () => {
      expect(parseForgeUrl('https://github.com/pull/5')).toBeNull();
    });

    it('rejects a pull path with extra segments before the repo (GitHub owner is a single segment)', () => {
      expect(parseForgeUrl('https://github.com/a/b/c/pull/1')).toBeNull();
    });

    it('rejects a merge_requests path missing the /-/ marker', () => {
      expect(parseForgeUrl('https://gitlab.com/group/project/merge_requests/5')).toBeNull();
    });
  });
});

describe('ForgeCliUnavailableError', () => {
  it('is an Error carrying forge and cli identification', () => {
    const error = new ForgeCliUnavailableError(
      'github',
      'gh',
      'gh: command not found'
    );
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ForgeCliUnavailableError);
    expect(error.name).toBe('ForgeCliUnavailableError');
    expect(error.forge).toBe('github');
    expect(error.cli).toBe('gh');
    expect(error.message).toBe('gh: command not found');
  });
});

describe('ForgeProvider contract', () => {
  it('accepts a conversation-plane-only implementation', async () => {
    const thread: ForgeThread = {
      root: { remoteId: '100', author: 'octocat', body: 'Looks wrong.' },
      replies: [{ remoteId: '101', author: 'hubot', body: 'Fixed.' }],
      anchor: {
        filePath: 'src/index.ts',
        side: 'new',
        startLine: 3,
        endLine: 5,
        outdated: false,
      },
    };
    const provider: ForgeProvider = {
      forge: 'github',
      fetchBaseBranch: async () => 'main',
      fetchThreads: async (_url, options) =>
        options?.includeResolved ? [thread] : [],
    };
    const url = parseForgeUrl('https://github.com/o/r/pull/1') as ForgeUrl;
    expect(await provider.fetchBaseBranch(url)).toBe('main');
    expect(await provider.fetchThreads(url)).toEqual([]);
    expect(await provider.fetchThreads(url, { includeResolved: true })).toEqual([thread]);
  });
});
