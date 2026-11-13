import { describe, expect, it, vi } from 'vitest';
import { FORGE_CATALOG, createForgeProvider } from './forge-catalog';
import { FORGE_DEFINITIONS } from './forge-definitions';
import { parseForgeUrl } from './forge-provider';

describe('forge composition', () => {
  it('preserves the pure matching order, snapshot refs and injected runner', async () => {
    expect(Object.keys(FORGE_CATALOG)).toEqual(Object.keys(FORGE_DEFINITIONS));
    for (const forge of ['gitlab', 'github'] as const) {
      const definition = FORGE_CATALOG[forge];
      const runner = vi.fn().mockResolvedValue({
        stdout: forge === 'github' ? '{"baseRefName":"main"}' : '{"target_branch":"main"}',
        stderr: '',
        exitCode: 0,
      });
      const url = parseForgeUrl(
        forge === 'github'
          ? 'https://forge.example/owner/repo/pull/7'
          : 'https://forge.example/group/sub/repo/-/merge_requests/7'
      )!;
      expect(
        definition.urlPath.test(
          forge === 'github' ? '/owner/repo/pull/7' : '/group/sub/repo/-/merge_requests/7'
        )
      ).toBe(true);
      expect(definition.headRef(7)).toBe(
        forge === 'github' ? 'refs/pull/7/head' : 'refs/merge-requests/7/head'
      );
      const provider = createForgeProvider(forge, runner);
      expect(provider.forge).toBe(forge);
      expect(await provider.fetchBaseBranch(url)).toBe('main');
      expect(runner.mock.calls[0][0]).toBe(forge === 'github' ? 'gh' : 'glab');
    }
  });
});
