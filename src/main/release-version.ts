interface ReleaseVersion {
  core: string[];
  prerelease: string[];
}
function parseVersion(value: string): ReleaseVersion | null {
  const match =
    /^(\d+(?:\.\d+){0,2})(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
      value
    );
  if (!match) return null;
  const core = match[1].split('.');
  while (core.length < 3) core.push('0');
  return { core, prerelease: match[2]?.split('.') ?? [] };
}
// Numeric strings avoid precision loss for accepted long identifiers. Keep the historical
// short-tag and leading-zero grammar, while applying semantic precedence and ignoring builds.
function numericCompare(a: string, b: string): number {
  a = a.replace(/^0+/, '') || '0';
  b = b.replace(/^0+/, '') || '0';
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}
export function isNewerRelease(current: string, latest: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(latest);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    const order = numericCompare(a.core[i], b.core[i]);
    if (order) return order < 0;
  }
  if (!a.prerelease.length || !b.prerelease.length)
    return a.prerelease.length > 0 && b.prerelease.length === 0;
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const left = a.prerelease[i];
    const right = b.prerelease[i];
    if (left === undefined || right === undefined) return left === undefined;
    const ln = /^\d+$/.test(left);
    const rn = /^\d+$/.test(right);
    const order =
      ln && rn
        ? numericCompare(left, right)
        : ln !== rn
          ? ln
            ? -1
            : 1
          : left < right
            ? -1
            : left > right
              ? 1
              : 0;
    if (order) return order < 0;
  }
  return false;
}
