import { useDiffNavigationContext } from '../context/DiffNavigationContext';
import type { DiffNavigationContextValue } from '../context/DiffNavigationContext';

export type DiffNavigationState = DiffNavigationContextValue;

export function useDiffNavigation(): DiffNavigationState {
  return useDiffNavigationContext();
}
