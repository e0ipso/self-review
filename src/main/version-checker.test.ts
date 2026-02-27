import { describe, it, expect } from 'vitest';
import { compareVersions } from './version-checker';

describe('compareVersions', () => {
  it('returns true when latest has higher patch', () => {
    expect(compareVersions('1.17.1', '1.17.2')).toBe(true);
  });

  it('returns true when latest has higher minor', () => {
    expect(compareVersions('1.17.1', '1.18.0')).toBe(true);
  });

  it('returns true when latest has higher major', () => {
    expect(compareVersions('1.17.1', '2.0.0')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(compareVersions('1.17.1', '1.17.1')).toBe(false);
  });

  it('returns false when current is newer', () => {
    expect(compareVersions('2.0.0', '1.17.1')).toBe(false);
  });

  it('returns false when current has higher minor', () => {
    expect(compareVersions('1.18.0', '1.17.5')).toBe(false);
  });

  it('handles versions with missing patch segment', () => {
    expect(compareVersions('1.17', '1.17.1')).toBe(true);
  });

  it('handles both versions missing patch', () => {
    expect(compareVersions('1.17', '1.17')).toBe(false);
  });
});
