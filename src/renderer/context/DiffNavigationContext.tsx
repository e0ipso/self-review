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

export function DiffNavigationProvider({ children }: { children: ReactNode }) {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  const scrollToFile = useCallback((filePath: string) => {
    const diffViewer = document.querySelector('[data-diff-viewer]');
    const element = diffViewer?.querySelector(`[data-file-path="${filePath}"]`);
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

        if (mostVisible && mostVisible.isIntersecting) {
          const filePath = mostVisible.target.getAttribute('data-file-path');
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

    // Observe all file sections (scoped to diff viewer to avoid FileTree buttons)
    const observeElements = () => {
      const diffViewer = document.querySelector('[data-diff-viewer]');
      if (!diffViewer) return;
      const elements = diffViewer.querySelectorAll('[data-file-path]');
      elements.forEach(el => observer.observe(el));
    };

    // Initial observation
    observeElements();

    // Re-observe when DOM changes (files are rendered)
    const mutationObserver = new MutationObserver(() => {
      observeElements();
    });

    const diffViewer = document.querySelector('[data-diff-viewer]');
    if (diffViewer) {
      mutationObserver.observe(diffViewer, { childList: true, subtree: true });
    }

    return () => {
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
