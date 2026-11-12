/** Lone UTF-16 surrogates cannot round-trip through UTF-8 without replacement. */
export function isWellFormedUnicode(value: string): boolean {
  return !/[\uD800-\uDFFF]/u.test(value);
}
