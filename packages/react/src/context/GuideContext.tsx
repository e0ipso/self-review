import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import type { GuideLoadPayload } from '@self-review/types';
import { useAdapter } from './ReviewAdapterContext';
import type { GuideMode } from '../utils/guide-display';

export interface GuideContextValue {
  /** The loaded walkthrough guide, or null when no guide was discovered. */
  guide: GuideLoadPayload | null;
  /** Current presentation mode. Only meaningful when a guide is loaded. */
  mode: GuideMode;
  setMode: (mode: GuideMode) => void;
  /** Feed a guide payload into the context (host subscription or fixture). */
  setGuide: (guide: GuideLoadPayload) => void;
  /** Guide-authored one-liner for a file; undefined for implicit-group files. */
  getFileDescription: (filePath: string) => string | undefined;
  /**
   * Display-order index of the group a file belongs to; undefined when no
   * guide is loaded or the guide never mentions the file. Drives the
   * per-group accent on surfaces that show a single file.
   */
  getFileGroupIndex: (filePath: string) => number | undefined;
}

/**
 * Default value used when no GuideProvider is mounted: behaves exactly like
 * "no guide loaded", so components that consult the guide render today's
 * flat experience unchanged.
 */
const NO_GUIDE: GuideContextValue = {
  guide: null,
  mode: 'flat',
  setMode: () => {},
  setGuide: () => {},
  getFileDescription: () => undefined,
  getFileGroupIndex: () => undefined,
};

const GuideContext = createContext<GuideContextValue>(NO_GUIDE);

export function useGuide(): GuideContextValue {
  return useContext(GuideContext);
}

export interface GuideProviderProps {
  children: ReactNode;
  /** Optional: provide a guide payload directly instead of via the adapter. */
  initialGuide?: GuideLoadPayload;
}

export function GuideProvider({ children, initialGuide }: GuideProviderProps) {
  const [guide, setGuide] = useState<GuideLoadPayload | null>(
    initialGuide ?? null
  );
  // Session state only — never persisted. Guided is the default whenever a
  // guide is present; without a guide the mode is ignored by consumers.
  const [mode, setMode] = useState<GuideMode>('guided');
  const adapter = useAdapter();

  useEffect(() => {
    if (initialGuide || !adapter?.onGuideLoad) return;
    return adapter.onGuideLoad(payload => setGuide(payload));
  }, [adapter, initialGuide]);

  const descriptionsByPath = useMemo(() => {
    const map = new Map<string, string>();
    guide?.groups.forEach(group => {
      group.files.forEach(file => {
        if (file.description !== undefined && !map.has(file.path)) {
          map.set(file.path, file.description);
        }
      });
    });
    return map;
  }, [guide]);

  const groupIndexByPath = useMemo(() => {
    const map = new Map<string, number>();
    guide?.groups.forEach((group, index) => {
      group.files.forEach(file => {
        if (!map.has(file.path)) map.set(file.path, index);
      });
    });
    return map;
  }, [guide]);

  const getFileDescription = useCallback(
    (filePath: string) => descriptionsByPath.get(filePath),
    [descriptionsByPath]
  );

  const getFileGroupIndex = useCallback(
    (filePath: string) => groupIndexByPath.get(filePath),
    [groupIndexByPath]
  );

  return (
    <GuideContext.Provider
      value={{
        guide,
        mode,
        setMode,
        setGuide,
        getFileDescription,
        getFileGroupIndex,
      }}
    >
      {children}
    </GuideContext.Provider>
  );
}
