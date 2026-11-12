import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DiffFile, FileReviewState } from '@self-review/types';
import { usePortalContainer } from './ConfigContext';

/** Above this file count all sections start collapsed. Large payloads always do. */
export const COLLAPSE_THRESHOLD = 50;

type Expansion = {
  expanded: ReadonlyMap<string, boolean>;
  setExpanded: (path: string, expanded: boolean) => void;
  setAllExpanded: (expanded: boolean, paths?: readonly string[]) => void;
};
type Disclosure = {
  isCollapsed: (id: string) => boolean;
  allCollapsed: boolean;
  setCollapsed: (id: string, collapsed: boolean) => void;
  setAllCollapsed: (collapsed: boolean) => void;
};
const ExpansionContext = createContext<Expansion | null>(null);
const DisclosureContext = createContext<Disclosure | null>(null);

export function useReviewExpansion() {
  const value = useContext(ExpansionContext);
  if (!value) throw new Error('Display commands require ReviewProvider');
  return value;
}
export function useCommentDisclosure() {
  const value = useContext(DisclosureContext);
  if (!value) throw new Error('Display commands require ReviewProvider');
  return value;
}

/** Private composition owned by ReviewProvider; reset by session, never by snapshot. */
export function ReviewDisplayProvider({
  files,
  sessionId = 0,
  isLargePayload,
  reviewFiles,
  children,
}: {
  files: DiffFile[];
  sessionId?: number;
  isLargePayload: boolean;
  reviewFiles: FileReviewState[];
  children: React.ReactNode;
}) {
  const [seenSession, setSeenSession] = useState(sessionId);
  const [collapsed, setCollapsed] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [defaultCollapsed, setDefaultCollapsed] = useState(false);
  const [seen, setSeen] = useState<DiffFile[] | null>(null);
  const [expanded, setExpansion] = useState<ReadonlyMap<string, boolean>>(new Map());
  // Reconcile before children commit so a new large file cannot fetch under an old default.
  // Retain the first default and explicit choices for paths already seen in this session.
  if (seen !== files || seenSession !== sessionId) {
    setSeen(files);
    const replacement = seenSession !== sessionId;
    if (replacement) {
      setSeenSession(sessionId);
      setCollapsed(new Map());
      setDefaultCollapsed(false);
    }
    const next = new Map(replacement ? [] : expanded);
    const initial = !isLargePayload && files.length <= COLLAPSE_THRESHOLD;
    for (const file of files) {
      const path = file.newPath || file.oldPath;
      if (!next.has(path)) next.set(path, initial);
    }
    setExpansion(next);
  }
  const expansion = useMemo<Expansion>(
    () => ({
      expanded,
      setExpanded: (path, value) => setExpansion(previous => new Map(previous).set(path, value)),
      setAllExpanded: (value, paths = files.map(file => file.newPath || file.oldPath)) =>
        setExpansion(previous => {
          const next = new Map(previous);
          for (const path of paths) next.set(path, value);
          return next;
        }),
    }),
    [expanded, files]
  );
  const disclosure = useMemo<Disclosure>(() => {
    const isCollapsed = (id: string) => collapsed.get(id) ?? defaultCollapsed;
    const ids = reviewFiles.flatMap(file => file.comments.map(comment => comment.id));
    return {
      isCollapsed,
      allCollapsed: ids.length ? ids.every(isCollapsed) : defaultCollapsed,
      setCollapsed: (id, value) => setCollapsed(previous => new Map(previous).set(id, value)),
      setAllCollapsed: value => {
        setDefaultCollapsed(value);
        setCollapsed(new Map());
      },
    };
  }, [collapsed, defaultCollapsed, reviewFiles]);
  return (
    <ExpansionContext.Provider value={expansion}>
      <DisclosureContext.Provider value={disclosure}>
        <LegacyDisplayBridge files={files}>{children}</LegacyDisplayBridge>
      </DisclosureContext.Provider>
    </ExpansionContext.Provider>
  );
}

/** The only legacy DOM protocol boundary. First-party controls call typed commands.
 * Target this review's data-review-display-root. For old hosts dispatching directly on their
 * ConfigProvider container, accept only an unambiguous single review. Never fan out across roots.
 */
function LegacyDisplayBridge({
  children,
  files,
}: {
  children: React.ReactNode;
  files: DiffFile[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const portal = usePortalContainer();
  const { setAllExpanded } = useReviewExpansion();
  const { setAllCollapsed } = useCommentDisclosure();
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const handle = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.self-review') !== element.closest('.self-review')) return;
      const owner = target.closest('[data-review-display-root]');
      if (target !== portal && event.currentTarget === portal) return;
      if (owner !== element) {
        if (target !== portal) return;
        const roots = [...portal.querySelectorAll('[data-review-display-root]')].filter(
          node => node.closest('.self-review') === portal
        );
        if (roots.length !== 1 || roots[0] !== element) return;
      }
      const detail = (event as CustomEvent).detail;
      if (event.type === 'toggle-all-sections' && typeof detail?.expanded === 'boolean')
        setAllExpanded(
          detail.expanded,
          files.map(file => file.newPath || file.oldPath)
        );
      if (event.type === 'toggle-all-comments' && typeof detail?.collapsed === 'boolean')
        setAllCollapsed(detail.collapsed);
    };
    // Events on descendants bubble here; direct container events retain the old call form.
    for (const name of ['toggle-all-sections', 'toggle-all-comments']) {
      element.addEventListener(name, handle);
      portal?.addEventListener(name, handle);
    }
    return () => {
      for (const name of ['toggle-all-sections', 'toggle-all-comments']) {
        element.removeEventListener(name, handle);
        portal?.removeEventListener(name, handle);
      }
    };
  }, [portal, setAllExpanded, setAllCollapsed, files]);
  return (
    <div ref={root} data-review-display-root style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
