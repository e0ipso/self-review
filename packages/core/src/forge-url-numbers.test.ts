import { describe, expect, it } from 'vitest';
import { parseForgeUrl } from './forge-provider';

describe.each([
  'https://forge.example/owner/repo/pull/',
  'https://forge.example/group/sub/repo/-/merge_requests/',
])('request numbers for %s', prefix => {
  it.each(['1', '42', String(Number.MAX_SAFE_INTEGER)])(
    'accepts %s with query and fragment',
    digits => {
      expect(parseForgeUrl(`${prefix}${digits}?tab=files#note`)?.number).toBe(Number(digits));
    }
  );
  it.each(['0', '00', '9007199254740992', '9007199254740993', '9'.repeat(10000)])(
    'refuses invalid digits %#',
    digits => {
      expect(parseForgeUrl(`${prefix}${digits}`)).toBeNull();
    }
  );
});
