import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useId } from 'react';
import { flushSync } from 'react-dom';
import { Group, Panel, Separator, type PanelImperativeHandle } from 'react-resizable-panels';
import { GripVertical } from 'lucide-react';
import FileTree from './FileTree';
import DiffViewer from './DiffViewer/DiffViewer';
import GuideRouteHud from './GuideRouteHud';
import FileTreeToggle from './FileTreeToggle';

import { useFileTreeExpansion } from '../context/FileTreeExpansionContext';
import { usePortalContainer } from '../context/ConfigContext';

function Layout() {
  const expansion = useFileTreeExpansion();
  const portalContainer = usePortalContainer();
  const panelId = useId();
  const fileTreePanelId = `${panelId}-file-tree`;
  const diffPanelId = `${panelId}-diff-viewer`;
  const fileTreePanel = useRef<PanelImperativeHandle | null>(null);
  const [fileTreeCollapsed, setFileTreeCollapsed] = useState(false);

  // The panel itself holds the authoritative collapsed state; mirroring it into
  // React state keeps the toggle's icon, label and the sidebar's inert flag in
  // step whether the change came from the button or from dragging the separator
  // past the panel's minimum size.
  const syncCollapsed = useCallback(() => {
    setFileTreeCollapsed(fileTreePanel.current?.isCollapsed() ?? false);
  }, []);

  const toggleFileTree = useCallback(() => {
    const panel = fileTreePanel.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
    syncCollapsed();
  }, [syncCollapsed]);

  // The layout owns the panel library and commits its restore before acknowledging measurement.
  const expandFileTree = useCallback(() => {
    const panel = fileTreePanel.current;
    if (!panel) return false;
    if (panel.isCollapsed()) {
      flushSync(() => {
        panel.expand();
        syncCollapsed();
      });
    }
    return !panel.isCollapsed();
  }, [syncCollapsed]);
  useLayoutEffect(() => expansion?.register(expandFileTree), [expansion, expandFileTree]);

  // Compatibility for embedded controls that still request expansion through the scoped root.
  useEffect(() => {
    const legacyExpand = () => {
      expandFileTree();
    };
    portalContainer?.addEventListener('expand-file-tree', legacyExpand);
    return () => portalContainer?.removeEventListener('expand-file-tree', legacyExpand);
  }, [expandFileTree, portalContainer]);

  return (
    <Group orientation='horizontal' style={{ flex: 1 }}>
      <Panel
        id={fileTreePanelId}
        panelRef={fileTreePanel}
        collapsible
        collapsedSize='0%'
        defaultSize='25%'
        minSize='10%'
        maxSize='60%'
        onResize={syncCollapsed}
      >
        {/* Opaque sidebar token, not a translucent wash: the .self-review
            wrapper is display:contents, so anything translucent here blends
            with the host page behind the panel. The tree stays mounted while
            collapsed so search text, scroll position and review state survive
            the round trip; `inert` keeps the clipped content out of the tab
            order and off the accessibility tree while it is not visible. */}
        <div
          className='h-full overflow-hidden bg-sidebar text-sidebar-foreground'
          // `|| undefined` rather than the bare boolean: React 18 stringifies
          // `false` into an `inert="false"` attribute, which browsers treat as
          // inert, and this package supports React 18 hosts.
          inert={fileTreeCollapsed || undefined}
        >
          <FileTree />
        </div>
      </Panel>

      <Separator className='relative flex w-px items-center justify-center bg-border'>
        <div className='z-10 flex h-4 w-3.5 items-center justify-center rounded-sm border bg-border'>
          <GripVertical className='h-2.5 w-2.5' />
        </div>
      </Separator>

      <Panel id={diffPanelId} defaultSize='75%'>
        <div className='relative h-full'>
          <div className='h-full overflow-y-auto bg-background' data-scroll-container='diff'>
            <DiffViewer />
          </div>
          <div className='absolute bottom-4 left-4 z-30'>
            <FileTreeToggle
              collapsed={fileTreeCollapsed}
              controls={fileTreePanelId}
              onToggle={toggleFileTree}
            />
          </div>
          <GuideRouteHud />
        </div>
      </Panel>
    </Group>
  );
}

export default React.memo(Layout);
