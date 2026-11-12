import { describe, expect, it } from 'vitest';
import * as policy from './remote-feedback';
import * as facade from './remote-mode';
import type { ReviewComment, ReviewState } from './types';

const comment = (id: string, remoteId?: string): ReviewComment => ({
  id,
  remoteId,
  filePath: 'file',
  lineRange: null,
  body: id,
  category: '',
  suggestion: null,
});

describe('pure remote feedback policy', () => {
  it('retains direct facade aliases and the original mutable comment references', () => {
    expect(facade.mergeRemoteThreads).toBe(policy.mergeRemoteThreads);
    expect(facade.applyRemoteProvenance).toBe(policy.applyRemoteProvenance);
    expect(facade.computeRemoteDrift).toBe(policy.computeRemoteDrift);
    const resumed = [comment('saved', ''), comment('local')];
    const fetched = [
      comment('conflict', ''),
      comment('first', 'new'),
      comment('second', 'new'),
      comment('anonymous'),
    ];
    const merged = policy.mergeRemoteThreads(resumed, fetched);
    expect(merged).toEqual([resumed[0], resumed[1], fetched[1], fetched[2], fetched[3]]);
    expect(merged[0]).toBe(resumed[0]);
    expect(merged[2]).toBe(fetched[1]);
    expect(resumed).toHaveLength(2);
    expect(fetched).toHaveLength(4);
  });

  it('replaces stale provenance with exactly the live remote metadata and shares files', () => {
    const state: ReviewState = {
      timestamp: '2026-11-12T00:00:00Z',
      files: [],
      source: { type: 'git', repository: '/private-clone', gitDiffArgs: 'old...head' },
      remoteUrl: 'old',
      remoteBaseSha: 'old',
      remoteHeadSha: 'old',
      remoteForge: 'gitlab',
    };
    const result = policy.applyRemoteProvenance(state, {
      remoteUrl: 'https://github.com/o/r/pull/1',
      remoteBaseSha: 'base',
      remoteHeadSha: 'head',
      remoteForge: 'github',
      threadSyncAvailable: true,
      temporaryClone: true,
    });
    expect(result).toEqual({
      timestamp: state.timestamp,
      files: [],
      source: { type: 'welcome' },
      remoteUrl: 'https://github.com/o/r/pull/1',
      remoteBaseSha: 'base',
      remoteHeadSha: 'head',
      remoteForge: 'github',
    });
    expect(result.files).toBe(state.files);
    expect(state.source.type).toBe('git');
    expect(state.remoteUrl).toBe('old');
  });

  it('distinguishes an absent recorded head from empty, matching and changed heads', () => {
    expect(policy.computeRemoteDrift(undefined, 'head')).toBeNull();
    expect(policy.computeRemoteDrift('', 'head')).toEqual({
      recordedHeadSha: '',
      liveHeadSha: 'head',
      drifted: true,
    });
    expect(policy.computeRemoteDrift('head', 'head')).toEqual({
      recordedHeadSha: 'head',
      liveHeadSha: 'head',
      drifted: false,
    });
    expect(policy.computeRemoteDrift('old', 'head')).toEqual({
      recordedHeadSha: 'old',
      liveHeadSha: 'head',
      drifted: true,
    });
  });
});
