import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';

export interface DiffNavigationContextValue {
  activeFilePath: string | null;
  scrollToFile: (filePath: string) => void;
  /**
   * Records the root element of a file's diff section. File sections call
   * this from a callback ref so navigation can reach them by path without
   * building a CSS selector out of a filename: a quote, backslash or newline
   * in a valid filename would otherwise make the selector throw or match the
   * wrong element.
   */
  registerFileElement: (filePath: string, element: HTMLElement) => void;
  /** Forgets `element` for `filePath`, unless another element replaced it. */
  unregisterFileElement: (filePath: string, element: HTMLElement) => void;
  /** The registered diff section element for `filePath`, if it is mounted. */
  getFileElement: (filePath: string) => HTMLElement | null;
}

const DiffNavigationContext = createContext<DiffNavigationContextValue | null>(null);

export function useDiffNavigationContext(): DiffNavigationContextValue {
  const context = useContext(DiffNavigationContext);
  if (!context) {
    throw new Error('useDiffNavigationContext must be used within a DiffNavigationProvider');
  }
  return context;
}

/**
 * Nullable variant for components that merely enhance with navigation when a
 * provider is present (e.g. the guide overview's clickable itinerary) and
 * must still render without one.
 */
export function useOptionalDiffNavigation(): DiffNavigationContextValue | null {
  return useContext(DiffNavigationContext);
}

export function DiffNavigationProvider({ children }: { children: ReactNode }) {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const fileElements = useRef(new Map<string, HTMLElement>());

  const registerFileElement = useCallback((filePath: string, element: HTMLElement) => {
    fileElements.current.set(filePath, element);
  }, []);

  const unregisterFileElement = useCallback((filePath: string, element: HTMLElement) => {
    // Two sections can briefly share a path (a remount, or a diff that lists
    // one path twice); only the element that is still registered may leave.
    if (fileElements.current.get(filePath) === element) {
      fileElements.current.delete(filePath);
    }
  }, []);

  const getFileElement = useCallback(
    (filePath: string) => fileElements.current.get(filePath) ?? null,
    []
  );

  const scrollToFile = useCallback(
    (filePath: string) => {
      getFileElement(filePath)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [getFileElement]
  );

  useEffect(() => {
    // Set up IntersectionObserver to track which file section is visible
    const observer = new IntersectionObserver(
      entries => {
        // Find the most visible entry
        let maxRatio = 0;
        let mostVisible: IntersectionObserverEntry | null = null;

        entries.forEach(entry => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisible = entry;
          }
        });

        if (mostVisible && (mostVisible as IntersectionObserverEntry).isIntersecting) {
          const filePath = (mostVisible as IntersectionObserverEntry).target.getAttribute(
            'data-file-path'
          );
          if (filePath) {
            setActiveFilePath(filePath);
          }
        }
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: '-20% 0px -20% 0px',
      }
    );

    // Observe file sections within the diff viewer only
    const observeElements = () => {
      const scrollContainer = document.querySelector('[data-scroll-container="diff"]');
      if (!scrollContainer) return;
      const elements = scrollContainer.querySelectorAll('[data-file-path]');
      elements.forEach(el => observer.observe(el));
    };

    // Initial observation
    observeElements();

    // Re-observe when the DOM changes. The diff loads asynchronously, so
    // neither the file sections nor the diff viewer container exist when
    // this provider mounts — watch the document and re-observe (idempotent
    // per element) whenever sections appear or change, debounced to one
    // sweep per frame.
    let rafId = 0;
    const mutationObserver = new MutationObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(observeElements);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

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
