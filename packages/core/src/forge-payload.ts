// Shared checks for the small JSON subsets consumed by the two forge adapters.
// Unknown extension fields are ignored; optional API metadata may be absent or null.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

export function isOptionalNumber(value: unknown): boolean {
  return (
    value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value))
  );
}

export function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'boolean';
}

export function isNumericId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** Semantically unusable numeric anchors stay visible as file-level discussion. */
export function hasUsableLines(start: number | null, end: number | null): boolean {
  return (
    start !== null &&
    end !== null &&
    Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start > 0 &&
    end > 0
  );
}
