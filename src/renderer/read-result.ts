import type { DesktopReadResult, DiffHunk } from '../shared/types';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid desktop read response.');
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length <= limit;
}
function nonnegative(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
function hunks(value: unknown): value is DiffHunk[] | null {
  if (value === null) return true;
  if (!Array.isArray(value) || value.length > 100_000) return false;
  let lines = 0;
  let chars = 0;
  for (const candidate of value) {
    const hunk = record(candidate);
    if (!text(hunk.header, 32 * 1024 * 1024)) return false;
    chars += hunk.header.length;
    if (chars > 16 * 1024 * 1024) return false;
    if (!['oldStart', 'newStart', 'oldLines', 'newLines'].every(key => nonnegative(hunk[key])))
      return false;
    if (!Array.isArray(hunk.lines) || (lines += hunk.lines.length) > 250_000) return false;
    for (const item of hunk.lines) {
      const line = record(item);
      if (
        !['addition', 'deletion', 'context'].includes(line.type as string) ||
        !text(line.content, 32 * 1024 * 1024) ||
        !['oldLineNumber', 'newLineNumber'].every(
          key => line[key] === null || nonnegative(line[key])
        )
      )
        return false;
      chars += line.content.length;
      if (chars > 16 * 1024 * 1024) return false;
    }
  }
  return true;
}

/** Decode the new protocol explicitly. Electron does not preserve custom Error fields. */
export function decodeReadResult(value: unknown): DesktopReadResult {
  const result = record(value);
  if (result.kind === 'error' && text(result.message, 2048) && text(result.code, 80)) {
    throw Object.assign(new Error(result.message), { code: result.code });
  }
  let valid = false;
  switch (result.kind) {
    case 'file':
      valid = hunks(result.hunks);
      break;
    case 'context': {
      if (result.context === null) valid = true;
      else {
        const context = record(result.context);
        valid = hunks(context.hunks) && context.hunks !== null && nonnegative(context.totalLines);
      }
      break;
    }
    case 'image': {
      const image = record(result.image);
      valid =
        text(image.error, 2048) ||
        (text(image.dataUri, 14 * 1024 * 1024) &&
          /^data:image\/[a-z0-9.+-]+;base64,/i.test(image.dataUri));
      break;
    }
    case 'attachment':
      valid =
        result.data === null ||
        (result.data instanceof ArrayBuffer && result.data.byteLength <= 10 * 1024 * 1024);
      break;
  }
  if (!valid) throw new Error('Invalid desktop read response.');
  return value as DesktopReadResult;
}
