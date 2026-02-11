import React, { useState } from 'react';
import FileTree from './FileTree';
import DiffViewer from './DiffViewer/DiffViewer';

export default function Layout() {
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
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
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel - File Tree */}
      <div
        style={{ width: `${leftPanelWidth}px` }}
        className="flex-shrink-0 bg-muted/30"
      >
        <FileTree />
      </div>

      {/* Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`w-px flex-shrink-0 cursor-col-resize transition-colors duration-150 ${
          isDragging
            ? 'bg-primary w-0.5'
            : 'bg-border hover:bg-muted-foreground/30'
        }`}
      />

      {/* Right Panel - Diff Viewer */}
      <div className="flex-1 overflow-y-auto bg-background">
        <DiffViewer />
      </div>
    </div>
  );
}
