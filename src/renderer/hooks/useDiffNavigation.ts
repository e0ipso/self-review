import { useState, useEffect, useCallback } from 'react';

export interface DiffNavigationState {
  activeFilePath: string | null;
  scrollToFile: (filePath: string) => void;
}

export function useDiffNavigation(): DiffNavigationState {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  const scrollToFile = useCallback((filePath: string) => {
    const element = document.querySelector(`[data-file-path="${filePath}"]`);
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

    // Observe all file sections
    const observeElements = () => {
      const elements = document.querySelectorAll('[data-file-path]');
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

  return {
    activeFilePath,
    scrollToFile,
  };
}
