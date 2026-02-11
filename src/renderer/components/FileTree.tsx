import React, { useState, useMemo } from 'react';
import { useReview } from '../context/ReviewContext';
import { useDiffNavigation } from '../hooks/useDiffNavigation';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Search, CircleDashed, CircleCheck, MessageSquare } from 'lucide-react';
import type { DiffFile } from '../../shared/types';

export default function FileTree() {
  const { diffFiles, files } = useReview();
  const { activeFilePath, scrollToFile } = useDiffNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return diffFiles;
    const query = searchQuery.toLowerCase();
    return diffFiles.filter((file) =>
      file.newPath.toLowerCase().includes(query)
    );
  }, [diffFiles, searchQuery]);

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

  const getCommentCount = (filePath: string) => {
    const fileState = files.find((f) => f.path === filePath);
    return fileState?.comments.length || 0;
  };

  const isViewed = (filePath: string) => {
    const fileState = files.find((f) => f.path === filePath);
    return fileState?.viewed || false;
  };

  const getChangeType = (changeType: DiffFile['changeType']) => {
    switch (changeType) {
      case 'added':
        return { label: 'A', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
      case 'modified':
        return { label: 'M', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
      case 'deleted':
        return { label: 'D', className: 'bg-red-500/15 text-red-700 dark:text-red-400' };
      case 'renamed':
        return { label: 'R', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' };
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="file-tree">
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Changed files
          </span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal tabular-nums rounded">
            {diffFiles.length}
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs bg-background"
            data-testid="file-search"
          />
        </div>
      </div>

      <Separator />

      {/* File List */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {filteredFiles.map((file) => {
            const filePath = file.newPath || file.oldPath;
            const stats = getFileStats(file);
            const commentCount = getCommentCount(filePath);
            const viewed = isViewed(filePath);
            const isActive = activeFilePath === filePath;
            const changeType = getChangeType(file.changeType);

            return (
              <Tooltip key={filePath}>
                <TooltipTrigger asChild>
                  <button
                    data-testid={`file-entry-${filePath}`}
                    onClick={() => scrollToFile(filePath)}
                    className={`w-full text-left px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Change type indicator */}
                      <span className={`flex-shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm text-[10px] font-bold leading-none ${changeType.className}`}>
                        {changeType.label}
                      </span>

                      {/* File path */}
                      <span className="flex-1 truncate font-mono text-xs leading-tight">
                        {filePath}
                      </span>

                      {/* Indicators */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {stats.additions > 0 && (
                          <span className="text-[10px] tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                            +{stats.additions}
                          </span>
                        )}
                        {stats.deletions > 0 && (
                          <span className="text-[10px] tabular-nums font-medium text-red-600 dark:text-red-400">
                            -{stats.deletions}
                          </span>
                        )}
                        {commentCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            <span className="text-[10px] tabular-nums">{commentCount}</span>
                          </span>
                        )}
                        {viewed ? (
                          <CircleCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <CircleDashed className="h-3.5 w-3.5 text-muted-foreground/60" />
                        )}
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-sm">
                  <p className="font-mono text-xs break-all">{filePath}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {filteredFiles.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-8">
              {searchQuery ? 'No files match your search' : 'No files in diff'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
