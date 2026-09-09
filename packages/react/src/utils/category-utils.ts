import type { CategoryDef } from '@self-review/types';

/**
 * A category is usable only when its name is a non-blank string. `CategorySelector`
 * and `CommentInput` both need this same notion of "usable" so a stray blank-name
 * entry can't produce a phantom selector option or become the default category
 * (see SR-0014). `ConfigProvider` reuses it to decide whether an embedder-supplied
 * `categories` list needs the same fallback the Node-only YAML loader applies
 * (see SR-0040) — including a shaped-wrong entry (e.g. a non-string `name` from a
 * plain-JS caller the type system can't stop), which is why `name` is read back
 * through an `unknown` cast instead of trusted at its declared type.
 */
export function isUsableCategory(category: CategoryDef): boolean {
  const name = (category as { name?: unknown } | null | undefined)?.name;
  return typeof name === 'string' && name.trim().length > 0;
}

/** Filters a categories list down to entries with a non-blank name. */
export function getUsableCategories(categories: CategoryDef[] | undefined): CategoryDef[] {
  return (categories ?? []).filter(isUsableCategory);
}

/** True when the list has at least one usable (non-blank-name) category. */
export function hasUsableCategory(categories: CategoryDef[] | undefined): boolean {
  return getUsableCategories(categories).length > 0;
}
