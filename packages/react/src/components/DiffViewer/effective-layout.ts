import type { DiffFile } from '@self-review/types';

/** Added and deleted files have only one reviewed side. */
export function effectiveDiffLayout(
  requested: 'split' | 'unified',
  changeType: DiffFile['changeType']
): 'split' | 'unified' {
  return changeType === 'added' || changeType === 'deleted' ? 'unified' : requested;
}
