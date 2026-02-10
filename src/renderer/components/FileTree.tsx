import React, { useState, useMemo } from 'react';
import { useReview } from '../context/ReviewContext';
import { useDiffNavigation } from '../hooks/useDiffNavigation';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import type { DiffFile } from '../../shared/types';

export default function FileTree() {
  const { diffFiles, files } = useReview();
  const { activeFilePath, scrollToFile } = useDiffNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter files by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return diffFiles;
    const query = searchQuery.toLowerCase();
    return diffFiles.filter((file) =>
      file.newPath.toLowerCase().includes(query)
    );
  }, [diffFiles, searchQuery]);

  // Calculate additions and deletions for each file
  const getFileStats = (file: DiffFile) => {
    let additions = 0;
    let deletions = 0;

    file.hunks.forEach((hunk) => {
      hunk.lines.forEach((line) => {
        if (line.type === 'addition') additions++;
        if (line.type === 'deletion') deletions++;
      });
    });

    return { additions, deletions };
  };

  // Get comment count for a file
  const getCommentCount = (filePath: string) => {
    const fileState = files.find((f) => f.path === filePath);
    return fileState?.comments.length || 0;
  };

  // Get viewed status for a file
  const isViewed = (filePath: string) => {
    const fileState = files.find((f) => f.path === filePath);
    return fileState?.viewed || false;
  };

  // Get change type badge variant and label
  const getChangeTypeBadge = (changeType: DiffFile['changeType']) => {
    switch (changeType) {
      case 'added':
        return { variant: 'default' as const, label: 'A', className: 'bg-green-600 hover:bg-green-700' };
      case 'modified':
        return { variant: 'default' as const, label: 'M', className: 'bg-yellow-600 hover:bg-yellow-700' };
      case 'deleted':
        return { variant: 'destructive' as const, label: 'D', className: 'bg-red-600 hover:bg-red-700' };
      case 'renamed':
        return { variant: 'default' as const, label: 'R', className: 'bg-blue-600 hover:bg-blue-700' };
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="p-3 border-b border-border">
        <Input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8"
        />
      </div>

      {/* File List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredFiles.map((file) => {
            const filePath = file.newPath || file.oldPath;
            const stats = getFileStats(file);
            const commentCount = getCommentCount(filePath);
            const viewed = isViewed(filePath);
            const isActive = activeFilePath === filePath;
            const changeTypeBadge = getChangeTypeBadge(file.changeType);

            return (
              <Tooltip key={filePath}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => scrollToFile(filePath)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Change Type Badge */}
                      <Badge
                        variant={changeTypeBadge.variant}
                        className={`${changeTypeBadge.className} text-white w-5 h-5 p-0 flex items-center justify-center text-xs`}
                      >
                        {changeTypeBadge.label}
                      </Badge>

                      {/* File Path */}
                      <span className="flex-1 truncate font-mono text-xs">
                        {filePath}
                      </span>

                      {/* Viewed Indicator */}
                      {viewed && (
                        <span className="text-green-500 text-xs">✓</span>
                      )}
                    </div>

                    {/* Stats and Comment Count */}
                    <div className="flex items-center gap-2 mt-1 ml-7 text-xs">
                      {stats.additions > 0 && (
                        <span className="text-green-600">+{stats.additions}</span>
                      )}
                      {stats.deletions > 0 && (
                        <span className="text-red-600">-{stats.deletions}</span>
                      )}
                      {commentCount > 0 && (
                        <Badge variant="outline" className="h-4 px-1 text-xs">
                          {commentCount} comment{commentCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-md">
                  <p className="font-mono text-xs break-all">{filePath}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {filteredFiles.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-4">
              {searchQuery ? 'No files match your search' : 'No files in diff'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
