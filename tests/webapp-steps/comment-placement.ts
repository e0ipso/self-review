/**
 * Where a rendered comment card sits in the diff.
 *
 * Pure DOM logic with no Playwright or launcher import, so both step trees can
 * use it. `tests/webapp-steps` drives the React library through Vite and
 * `tests/steps` drives the same components inside Electron, and both render
 * the same markup.
 */

export interface CommentPlacement {
  /** `data-testid` of the enclosing file section, `null` outside one. */
  section: string | null;
  /**
   * The (line, side) pairs carried by the diff row the card hangs off. Both
   * views emit the comment slot as the sibling right after the row that owns
   * the anchor, so these are the coordinates the UI chose, not the ones the
   * step asked for. A row that spans both sides reports both pairs: split
   * view puts the old and new halves in one wrapper, and a unified context
   * row carries an old and a new number in its two gutters.
   */
  anchors: { line: number; side: string }[];
  /** The card precedes every diff row of its section: the file-level band. */
  aboveDiffRows: boolean;
  /** The card is inside the "Comments outside the current diff" box. */
  orphaned: boolean;
}

/**
 * Read a comment card's placement out of the live DOM.
 *
 * Playwright serializes this function into the page, so its body must stay
 * self-contained and reference nothing at module scope.
 */
export function readCommentPlacement(commentEl: Element): CommentPlacement {
  const carriesLine = (node: Element | null): boolean =>
    node !== null &&
    (node.hasAttribute('data-line-number') || node.querySelector('[data-line-number]') !== null);

  const section = commentEl.closest('[data-testid^="file-section-"]');

  // Stop at the section boundary. The previous file section is full of rows,
  // and walking into it would report a neighbouring file's lines as the anchor.
  let node: Element | null = commentEl;
  while (node !== null && node !== section && !carriesLine(node.previousElementSibling)) {
    node = node.parentElement;
  }
  const row = node === null || node === section ? null : node.previousElementSibling;
  const pairs: { line: number; side: string }[] = [];
  if (row !== null) {
    const cells = row.hasAttribute('data-line-number')
      ? [row]
      : Array.from(row.querySelectorAll('[data-line-number]'));
    for (const cell of cells) {
      pairs.push({
        line: Number(cell.getAttribute('data-line-number')),
        side: cell.getAttribute('data-line-side') || '',
      });
    }
    // Unified view labels a context row with its new number alone, while both
    // gutters still carry a `<side>-line-<path>-<n>` test id. Reading those
    // recovers the old coordinate a comment on a deleted-side context line
    // anchors to.
    for (const gutter of Array.from(row.querySelectorAll('[data-testid]'))) {
      const match = /^(old|new)-line-.+-(\d+)$/.exec(gutter.getAttribute('data-testid') || '');
      if (match === null) continue;
      const pair = { line: Number(match[2]), side: match[1] };
      if (!pairs.some(p => p.line === pair.line && p.side === pair.side)) {
        pairs.push(pair);
      }
    }
  }
  const firstRow = section === null ? null : section.querySelector('[data-line-number]');

  return {
    section: section === null ? null : section.getAttribute('data-testid'),
    anchors: pairs,
    aboveDiffRows:
      firstRow !== null &&
      (commentEl.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    orphaned: commentEl.closest('section[aria-label="Comments outside the current diff"]') !== null,
  };
}
