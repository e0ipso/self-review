import type { DiffFile, ResolvedGuideGroup } from '@self-review/types';

/**
 * Presentation mode for the file tree when a walkthrough guide is loaded.
 * `flat` is exactly today's ungrouped view; `guided` layers the guide's
 * ordered groups on top of the same entries.
 */
export type GuideMode = 'guided' | 'flat';

/** Header rendered above a group's entries in the guided file tree. */
export interface GuideDisplayHeader {
  name: string;
  rationale?: string;
  implicit: boolean;
  /**
   * Index of the group in the guide payload. Stable under search
   * filtering (which omits emptied sections and shifts section positions),
   * so numbering and per-group accents key off it, not the section's
   * position. Absent only for the synthesized leftover header.
   */
  groupIndex?: number;
}

/** One file tree entry, optionally annotated with the guide's one-liner. */
export interface GuideDisplayEntry {
  file: DiffFile;
  /** Guide-authored one-liner; absent for implicit-group files and flat mode. */
  description?: string;
}

/** A run of entries under an optional group header. */
export interface GuideDisplaySection {
  header?: GuideDisplayHeader;
  entries: GuideDisplayEntry[];
}

function displayPath(file: DiffFile): string {
  return file.newPath || file.oldPath;
}

/**
 * Derive the file tree display list from the (already search-filtered) diff
 * files, the reconciled guide groups, and the current mode.
 *
 * - Flat mode, or no guide: a single headerless section with the files in
 *   input order — the identity layout, byte-for-byte today's tree.
 * - Guided mode: one section per group in payload order, files within each
 *   group in payload order, sections whose files were all filtered out are
 *   omitted. Files the guide never mentions stay reachable: they are
 *   appended to the implicit section when the payload has one, otherwise to
 *   a synthesized trailing "Everything else" section (implicit, no
 *   groupIndex) so they still render under a labeled group.
 *
 * Pure: no tolerance logic, no lookups outside its arguments.
 */
export function buildGuideDisplaySections(
  files: DiffFile[],
  groups: ResolvedGuideGroup[] | null,
  mode: GuideMode
): GuideDisplaySection[] {
  if (mode === 'flat' || !groups || groups.length === 0) {
    if (files.length === 0) return [];
    return [{ entries: files.map(file => ({ file })) }];
  }

  const byPath = new Map<string, DiffFile>();
  files.forEach(file => {
    const path = displayPath(file);
    if (!byPath.has(path)) byPath.set(path, file);
  });

  const consumed = new Set<string>();
  const sections: GuideDisplaySection[] = [];

  groups.forEach((group, groupIndex) => {
    const entries: GuideDisplayEntry[] = [];
    for (const guideFile of group.files) {
      const file = byPath.get(guideFile.path);
      if (!file || consumed.has(guideFile.path)) continue;
      consumed.add(guideFile.path);
      entries.push({ file, description: guideFile.description });
    }
    if (entries.length === 0) return;
    sections.push({
      header: {
        name: group.name,
        rationale: group.rationale,
        implicit: group.implicit,
        groupIndex,
      },
      entries,
    });
  });

  // Defensive: any surviving file the guide never mentioned stays reachable.
  const leftovers: GuideDisplayEntry[] = files
    .filter(file => !consumed.has(displayPath(file)))
    .map(file => ({ file }));

  if (leftovers.length > 0) {
    const last = sections[sections.length - 1];
    if (last?.header?.implicit) {
      last.entries.push(...leftovers);
    } else {
      // The payload had no implicit group: synthesize one so leftovers
      // still render under a labeled group instead of visually merging
      // into the preceding section.
      sections.push({
        header: { name: 'Everything else', implicit: true },
        entries: leftovers,
      });
    }
  }

  return sections;
}
