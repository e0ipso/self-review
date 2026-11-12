import { useLocalization } from '../localization/LocalizationContext';
import React, { useState, useMemo } from 'react';
import { useDiffReview, useNavigationReview, useReviewCommands } from '../context/ReviewContext';
import { useDiffNavigationContext } from '../context/DiffNavigationContext';
import { useGuide } from '../context/GuideContext';
import { buildGuideDisplaySections } from '../utils/guide-display';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { Search } from 'lucide-react';
import { FileTreeEntry } from './FileTreeEntry';
import FileTreeControls from './FileTreeControls';
import OutputPathControl from './OutputPathControl';
import { GuideStation } from './GuideStation';
import { getGuideAccent } from '../utils/guide-accents';

export default function FileTree() {
  const { t, number } = useLocalization();
  const { diffFiles } = useDiffReview();
  const summaries = useNavigationReview();
  const { toggleViewed } = useReviewCommands();
  const { activeFilePath, scrollToFile } = useDiffNavigationContext();
  const { guide, mode } = useGuide();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return diffFiles;
    const query = searchQuery.toLowerCase();
    // A deleted file has an empty newPath; match on the path the tree displays.
    return diffFiles.filter(file => (file.newPath || file.oldPath).toLowerCase().includes(query));
  }, [diffFiles, searchQuery]);

  // Ordering/annotation layer: flat mode (or no guide) yields a single
  // headerless section with the files untouched — today's tree by construction.
  const displaySections = useMemo(
    () => buildGuideDisplaySections(filteredFiles, guide?.groups ?? null, mode),
    [filteredFiles, guide, mode]
  );

  return (
    <div className='flex flex-col h-full' data-testid='file-tree'>
      {/* Header */}
      <div className='px-3 pt-3 pb-2'>
        <div className='flex items-center justify-between mb-2.5'>
          <span className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
            {t('Changed files')}
          </span>
          <FileTreeControls />
        </div>
        <div className='relative'>
          <Search className='absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none' />
          <Input
            type='text'
            placeholder={t('Filter files...')}
            aria-label={t('Filter files...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='h-7 ps-7 text-xs bg-background'
            data-testid='file-search'
          />
        </div>
      </div>

      <Separator />

      {/* File List */}
      <div className='flex-1 overflow-y-auto overflow-x-hidden p-1'>
        {displaySections.map((section, sectionIndex) => {
          // Station number, accent, and progress key off the group's payload
          // index and full file list, not the section's filtered position —
          // search filtering omits emptied sections and hides files, and the
          // station must stay in sync with the chapter dividers, route map,
          // and HUD (which all use payload indices).
          const stationIndex = section.header?.groupIndex ?? sectionIndex;
          const fullGroupPaths =
            section.header?.groupIndex !== undefined
              ? guide?.groups[section.header.groupIndex]?.files.map(f => f.path)
              : undefined;
          const progressPaths =
            fullGroupPaths ?? section.entries.map(({ file }) => file.newPath || file.oldPath);
          const viewedCount = section.header
            ? progressPaths.filter(path => summaries.get(path)?.viewed).length
            : 0;
          const entryNodes = section.entries.map(({ file, description }) => {
            const filePath = file.newPath || file.oldPath;
            return (
              <FileTreeEntry
                key={filePath}
                file={file}
                isActive={activeFilePath === filePath}
                commentCount={summaries.get(filePath)?.commentCount ?? 0}
                viewed={summaries.get(filePath)?.viewed ?? false}
                guideDescription={description}
                onScrollToFile={scrollToFile}
                onToggleViewed={toggleViewed}
              />
            );
          });
          if (!section.header)
            return (
              <React.Fragment key={`section-${sectionIndex}-flat`}>{entryNodes}</React.Fragment>
            );
          const isFirst = sectionIndex === 0;
          const isLast = sectionIndex === displaySections.length - 1;
          return (
            <div
              className='relative'
              // Keyed by position, not name alone: nothing forbids a guide
              // from repeating a group name (or naming one "Everything else",
              // colliding with the implicit group).
              key={`section-${sectionIndex}-${section.header.name}`}
            >
              {/* Route line: one continuous segment per section; adjacent
                  sections butt together so the line reads as a single
                  route. The implicit group joins by a dashed segment. */}
              <div
                className={`pointer-events-none absolute start-[18px] w-[2px] ${
                  isFirst ? 'top-[27px]' : 'top-0'
                } ${isLast ? 'bottom-2' : 'bottom-0'} ${
                  section.header.implicit
                    ? 'guide-route-dashed-v'
                    : getGuideAccent(stationIndex).segment
                }`}
                aria-hidden='true'
              />
              <div className='px-2 pt-4 pb-1.5' data-testid={`guide-group-${section.header.name}`}>
                <div className='flex items-center gap-2'>
                  <GuideStation
                    index={stationIndex}
                    implicit={section.header.implicit}
                    complete={progressPaths.length > 0 && viewedCount === progressPaths.length}
                    surfaceClassName='bg-sidebar'
                    className='relative z-10'
                  />
                  <span className='min-w-0 flex-1 truncate text-xs font-semibold text-foreground'>
                    {section.header.implicit ? t('Everything else') : section.header.name}
                  </span>
                  <span className='shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground'>
                    {number(viewedCount)}/{number(progressPaths.length)}
                  </span>
                </div>
                {section.header.rationale && (
                  <div className='mt-1 ps-[30px] text-[11px] leading-snug text-muted-foreground'>
                    {section.header.rationale}
                  </div>
                )}
              </div>
              <div className='ps-6'>{entryNodes}</div>
            </div>
          );
        })}

        {filteredFiles.length === 0 && (
          <div className='text-center text-muted-foreground text-xs py-8'>
            {t(searchQuery ? 'No files match your search' : 'No files in diff')}
          </div>
        )}
      </div>

      <OutputPathControl />
    </div>
  );
}
