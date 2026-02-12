import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiffNavigation } from './useDiffNavigation';

// Mock IntersectionObserver and MutationObserver before all tests
let intersectionCallback: IntersectionObserverCallback | null = null;
let mutationCallback: MutationCallback | null = null;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    intersectionCallback = callback;
    this.rootMargin = options?.rootMargin || '';
    this.thresholds = Array.isArray(options?.threshold)
      ? options.threshold
      : options?.threshold !== undefined
        ? [options.threshold]
        : [];
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

class MockMutationObserver implements MutationObserver {
  constructor(callback: MutationCallback) {
    mutationCallback = callback;
  }

  observe = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

describe('useDiffNavigation', () => {
  beforeAll(() => {
    global.IntersectionObserver = MockIntersectionObserver as any;
    global.MutationObserver = MockMutationObserver as any;
  });

  beforeEach(() => {
    // Clear the DOM
    document.body.innerHTML = '';
    intersectionCallback = null;
    mutationCallback = null;
    vi.clearAllMocks();
  });

  describe('scrollToFile', () => {
    it('scrolls to element with matching data-file-path', () => {
      const mockElement = document.createElement('div');
      mockElement.setAttribute('data-file-path', 'test.ts');
      const scrollIntoViewMock = vi.fn();
      mockElement.scrollIntoView = scrollIntoViewMock;
      document.body.appendChild(mockElement);

      const { result } = renderHook(() => useDiffNavigation());

      act(() => {
        result.current.scrollToFile('test.ts');
      });

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    it('does nothing when element is not found', () => {
      const { result } = renderHook(() => useDiffNavigation());

      // Should not throw
      act(() => {
        result.current.scrollToFile('non-existent.ts');
      });

      expect(result.current.activeFilePath).toBeNull();
    });

    it('handles multiple files and scrolls to correct one', () => {
      const element1 = document.createElement('div');
      element1.setAttribute('data-file-path', 'file1.ts');
      const scroll1 = vi.fn();
      element1.scrollIntoView = scroll1;

      const element2 = document.createElement('div');
      element2.setAttribute('data-file-path', 'file2.ts');
      const scroll2 = vi.fn();
      element2.scrollIntoView = scroll2;

      document.body.appendChild(element1);
      document.body.appendChild(element2);

      const { result } = renderHook(() => useDiffNavigation());

      act(() => {
        result.current.scrollToFile('file2.ts');
      });

      expect(scroll1).not.toHaveBeenCalled();
      expect(scroll2).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });

  describe('IntersectionObserver setup', () => {
    it('initializes with null activeFilePath', () => {
      const { result } = renderHook(() => useDiffNavigation());

      expect(result.current.activeFilePath).toBeNull();
    });

    it('updates activeFilePath when element becomes visible', () => {
      const element = document.createElement('div');
      element.setAttribute('data-file-path', 'file1.ts');
      document.body.appendChild(element);

      const { result } = renderHook(() => useDiffNavigation());

      // Simulate intersection
      if (intersectionCallback) {
        const entries: IntersectionObserverEntry[] = [
          {
            target: element,
            isIntersecting: true,
            intersectionRatio: 0.75,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: 0,
          },
        ];

        act(() => {
          intersectionCallback!(entries, {} as IntersectionObserver);
        });
      }

      expect(result.current.activeFilePath).toBe('file1.ts');
    });

    it('selects most visible element when multiple intersect', () => {
      const element1 = document.createElement('div');
      element1.setAttribute('data-file-path', 'file1.ts');
      const element2 = document.createElement('div');
      element2.setAttribute('data-file-path', 'file2.ts');
      document.body.appendChild(element1);
      document.body.appendChild(element2);

      const { result } = renderHook(() => useDiffNavigation());

      if (intersectionCallback) {
        const entries: IntersectionObserverEntry[] = [
          {
            target: element1,
            isIntersecting: true,
            intersectionRatio: 0.3,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: 0,
          },
          {
            target: element2,
            isIntersecting: true,
            intersectionRatio: 0.8, // More visible
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: 0,
          },
        ];

        act(() => {
          intersectionCallback!(entries, {} as IntersectionObserver);
        });
      }

      expect(result.current.activeFilePath).toBe('file2.ts');
    });

    it('ignores elements without data-file-path attribute', () => {
      const element = document.createElement('div');
      // No data-file-path attribute
      document.body.appendChild(element);

      const { result } = renderHook(() => useDiffNavigation());

      if (intersectionCallback) {
        const entries: IntersectionObserverEntry[] = [
          {
            target: element,
            isIntersecting: true,
            intersectionRatio: 1.0,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: 0,
          },
        ];

        act(() => {
          intersectionCallback!(entries, {} as IntersectionObserver);
        });
      }

      // Should remain null
      expect(result.current.activeFilePath).toBeNull();
    });

    it('ignores non-intersecting elements', () => {
      const element = document.createElement('div');
      element.setAttribute('data-file-path', 'file1.ts');
      document.body.appendChild(element);

      const { result } = renderHook(() => useDiffNavigation());

      if (intersectionCallback) {
        const entries: IntersectionObserverEntry[] = [
          {
            target: element,
            isIntersecting: false, // Not visible
            intersectionRatio: 0,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: 0,
          },
        ];

        act(() => {
          intersectionCallback!(entries, {} as IntersectionObserver);
        });
      }

      // Should remain null
      expect(result.current.activeFilePath).toBeNull();
    });
  });
});
