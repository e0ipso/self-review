import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

export interface DiffNavigationContextValue {
  activeFilePath: string | null;
  scrollToFile: (filePath: string) => void;
}

const DiffNavigationContext = createContext<DiffNavigationContextValue | null>(
  null
);

export function useDiffNavigationContext(): DiffNavigationContextValue {
  const context = useContext(DiffNavigationContext);
  if (!context) {
    throw new Error(
      'useDiffNavigationContext must be used within a DiffNavigationProvider'
    );
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

  const scrollToFile = useCallback((filePath: string) => {
    const scrollContainer = document.querySelector(
      '[data-scroll-container="diff"]'
    );
    const element = scrollContainer?.querySelector(
      `[data-file-path="${filePath}"]`
    );
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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
          const filePath = (mostVisible as IntersectionObserverEntry).target.getAttribute('data-file-path');
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
      const scrollContainer = document.querySelector(
        '[data-scroll-container="diff"]'
      );
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

  return (
    <DiffNavigationContext.Provider value={{ activeFilePath, scrollToFile }}>
      {children}
    </DiffNavigationContext.Provider>
  );
}
