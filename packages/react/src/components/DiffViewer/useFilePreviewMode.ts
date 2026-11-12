import { useState } from 'react';
import type { DiffFile } from '@self-review/types';
import type { FilePreviewDescriptor } from '../../services/content-preview';

// Feedback/viewed updates replace DiffFile objects too. Reset only for a change in reviewed
// content or preview policy, without remounting the section's expansion or comment composers.
export function useFilePreviewMode(file: DiffFile, preview: FilePreviewDescriptor) {
  // Keep string references rather than concatenating or copying the reviewed source. Comparing
  // values also observes a legacy caller mutating content in place, and ignores metadata clones.
  const content = preview.available
    ? file.hunks.flatMap(hunk => hunk.lines.map(line => line.content))
    : [];
  const [state, setState] = useState(() => ({
    path: file.newPath || file.oldPath,
    content,
    binary: file.isBinary,
    changeType: file.changeType,
    kind: preview.builtIn.kind,
    renderer: preview.renderer,
    mode: preview.defaultMode,
  }));
  const path = file.newPath || file.oldPath;
  const changed =
    state.path !== path ||
    state.content.length !== content.length ||
    state.content.some((line, index) => line !== content[index]) ||
    state.binary !== file.isBinary ||
    state.changeType !== file.changeType ||
    state.kind !== preview.builtIn.kind ||
    state.renderer !== preview.renderer;
  if (changed)
    setState({
      path,
      content,
      binary: file.isBinary,
      changeType: file.changeType,
      kind: preview.builtIn.kind,
      renderer: preview.renderer,
      mode: preview.defaultMode,
    });
  return {
    renderViewMode: changed ? preview.defaultMode : state.mode,
    setRenderViewMode: (mode: 'raw' | 'rendered') => setState(current => ({ ...current, mode })),
  };
}
