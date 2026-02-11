import React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { GripVertical } from 'lucide-react';
import FileTree from './FileTree';
import DiffViewer from './DiffViewer/DiffViewer';

export default function Layout() {
  return (
    <Group
      orientation="horizontal"
      style={{ flex: 1 }}
    >
      <Panel
        id="fileTree"
        defaultSize="25%"
        minSize="10%"
        maxSize="60%"
      >
        <div className="h-full overflow-hidden bg-muted/30">
          <FileTree />
        </div>
      </Panel>

      <Separator className="relative flex w-px items-center justify-center bg-border">
        <div className="z-10 flex h-4 w-3.5 items-center justify-center rounded-sm border bg-border">
          <GripVertical className="h-2.5 w-2.5" />
        </div>
      </Separator>

      <Panel id="diffViewer" defaultSize="75%">
        <div className="h-full overflow-y-auto bg-background">
          <DiffViewer />
        </div>
      </Panel>
    </Group>
  );
}
