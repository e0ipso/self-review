import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { reviewElement } from '../utils/review-root';
import { useConfig } from './ConfigContext';

export interface DiffNavigationContextValue {
  activeFilePath: string | null;
  scrollToFile: (filePath: string) => void;
  /** Lookup by path, never a CSS selector: quotes, backslashes and newlines break selectors. */
  registerFileElement: (filePath: string, element: HTMLElement) => void;
  unregisterFileElement: (filePath: string, element: HTMLElement) => void;
  getFileElement: (filePath: string) => HTMLElement | null;
}
const DiffNavigationContext = createContext<DiffNavigationContextValue | null>(null);
export function useDiffNavigationContext(): DiffNavigationContextValue {
  const value = useContext(DiffNavigationContext);
  if (!value)
    throw new Error('useDiffNavigationContext must be used within a DiffNavigationProvider');
  return value;
}
export function useOptionalDiffNavigation() {
  return useContext(DiffNavigationContext);
}

export function DiffNavigationProvider({ children }: { children: ReactNode }) {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const { portalContainer } = useConfig();
  const files = useRef(new Map<string, HTMLElement>());
  const intersections = useRef(new Map<Element, number>());
  const observer = useRef<IntersectionObserver | null>(null);
  const chooseActive = useCallback(() => {
    let path: string | null = null;
    let largest = 0;
    files.current.forEach((element, candidate) => {
      const ratio = intersections.current.get(element) ?? 0;
      if (ratio > largest) {
        largest = ratio;
        path = candidate;
      }
    });
    setActiveFilePath(path);
  }, []);
  const registerFileElement = useCallback((path: string, element: HTMLElement) => {
    const previous = files.current.get(path);
    if (previous && previous !== element) {
      observer.current?.unobserve(previous);
      intersections.current.delete(previous);
    }
    files.current.set(path, element);
    observer.current?.observe(element);
  }, []);
  const unregisterFileElement = useCallback(
    (path: string, element: HTMLElement) => {
      observer.current?.unobserve(element);
      intersections.current.delete(element);
      if (files.current.get(path) === element) files.current.delete(path);
      chooseActive();
    },
    [chooseActive]
  );
  const getFileElement = useCallback((path: string) => files.current.get(path) ?? null, []);
  const scrollToFile = useCallback(
    (path: string) => {
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      getFileElement(path)?.scrollIntoView({
        behavior: reduced ? 'instant' : 'smooth',
        block: 'start',
      });
    },
    [getFileElement]
  );
  useEffect(() => {
    const tracked = new IntersectionObserver(
      entries => {
        if (observer.current !== tracked) return;
        const registered = new Set(files.current.values());
        entries.forEach(entry => {
          if (registered.has(entry.target as HTMLElement))
            intersections.current.set(
              entry.target,
              entry.isIntersecting ? entry.intersectionRatio : 0
            );
        });
        chooseActive();
      },
      {
        root: reviewElement(portalContainer, '[data-scroll-container="diff"]'),
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: '-20% 0px -20% 0px',
      }
    );
    observer.current = tracked;
    intersections.current.clear();
    files.current.forEach(element => tracked.observe(element));
    return () => {
      tracked.disconnect();
      if (observer.current === tracked) observer.current = null;
      intersections.current.clear();
    };
  }, [portalContainer, chooseActive]);
  const value = useMemo(
    () => ({
      activeFilePath,
      scrollToFile,
      registerFileElement,
      unregisterFileElement,
      getFileElement,
    }),
    [activeFilePath, scrollToFile, registerFileElement, unregisterFileElement, getFileElement]
  );
  return <DiffNavigationContext.Provider value={value}>{children}</DiffNavigationContext.Provider>;
}
