import { describe, expect, it } from 'vitest';
import { capturePublicationOwnership, normalizePublicationState } from './publication-ownership';
import type { DiffLoadPayload, ReviewState } from './types';

const source = { type: 'git' as const, repository: '/repo', gitDiffArgs: '--staged' };
const state: ReviewState = {
  timestamp: 'now',
  source: { ...source, extension: 'source extension' } as ReviewState['source'],
  files: [],
  remoteUrl: 'spoof',
  remoteForge: 'gitlab',
  remoteBaseSha: 'spoof-base',
  remoteHeadSha: 'spoof-head',
};
const remote = {
  remoteUrl: 'https://github.com/o/r/pull/1',
  remoteForge: 'github' as const,
  remoteBaseSha: 'owned-base',
  remoteHeadSha: 'owned-head',
  temporaryClone: true,
  threadSyncAvailable: false,
};
function normalize(loaded: DiffLoadPayload | null, submitted = state) {
  return normalizePublicationState(submitted, loaded, capturePublicationOwnership(loaded));
}

describe('publication ownership', () => {
  it('strips all untrusted provenance locally and preserves source/state extensions', () => {
    const loaded = { source, files: [] };
    const extended = { ...state, extension: { keep: true } };
    const owned = normalize(loaded, extended);
    expect(owned).toEqual({
      timestamp: 'now',
      source: state.source,
      files: [],
      extension: { keep: true },
    });
    expect(owned?.source).toBe(state.source);
    expect(state.remoteUrl).toBe('spoof');
    expect(loaded.source).toBe(source);
  });

  it('takes every remote field only from the admitted load', () => {
    const owned = normalize({ source, files: [], remote });
    expect(owned).toMatchObject({
      remoteUrl: remote.remoteUrl,
      remoteForge: remote.remoteForge,
      remoteBaseSha: remote.remoteBaseSha,
      remoteHeadSha: remote.remoteHeadSha,
    });
    expect(owned).not.toHaveProperty('temporaryClone');
    expect(owned?.source).toBe(state.source);
  });

  it.each([null, { type: 'welcome' as const }, { type: 'loading' as const }])(
    'refuses a missing or non-review source %j',
    invalid => {
      expect(normalize(invalid ? { files: [], source: invalid } : null)).toBeNull();
    }
  );

  it('refuses foreign paths and git arguments without path normalization', () => {
    expect(normalize({ files: [], source: { ...source, repository: '/other' } })).toBeNull();
    expect(normalize({ files: [], source: { ...source, gitDiffArgs: '' } })).toBeNull();
  });

  it('refuses a replacement even with equal source fields', () => {
    const loaded = { source, files: [] };
    const captured = capturePublicationOwnership(loaded);
    expect(normalizePublicationState(state, { ...loaded }, captured)).toBeNull();
  });

  it('detects in-place source and remote changes without freezing public identities', () => {
    const loaded = { source: { ...source }, files: [], remote: { ...remote } };
    const captured = capturePublicationOwnership(loaded);
    loaded.source.gitDiffArgs = 'HEAD';
    expect(normalizePublicationState(state, loaded, captured)).toBeNull();
    loaded.source.gitDiffArgs = source.gitDiffArgs;
    loaded.remote.remoteHeadSha = 'new-head';
    expect(normalizePublicationState(state, loaded, captured)).toBeNull();
  });
});
