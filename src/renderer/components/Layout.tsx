import React, { useState } from 'react';
import FileTree from './FileTree';
import DiffViewer from './DiffViewer/DiffViewer';

export default function Layout() {
  const [leftPanelWidth, setLeftPanelWidth] = useState(250);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 600) {
      setLeftPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel - File Tree */}
      <div
        style={{ width: `${leftPanelWidth}px` }}
        className="flex-shrink-0 border-r border-border"
      >
        <FileTree />
      </div>

      {/* Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 cursor-col-resize bg-border hover:bg-accent transition-colors"
        style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }}
      />

      {/* Right Panel - Diff Viewer */}
      <div className="flex-1 overflow-y-auto">
        <DiffViewer />
      </div>
    </div>
  );
}
