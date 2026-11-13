/** Portals share the theme wrapper; nested embedded reviews still own their own descendants. */
export function reviewElements<T extends HTMLElement>(
  root: HTMLElement | null,
  selector: string
): T[] {
  return Array.from(root?.querySelectorAll<T>(selector) ?? []).filter(
    element => element.closest('.self-review') === root
  );
}
export function reviewElement<T extends HTMLElement>(
  root: HTMLElement | null,
  selector: string
): T | null {
  return reviewElements<T>(root, selector)[0] ?? null;
}
