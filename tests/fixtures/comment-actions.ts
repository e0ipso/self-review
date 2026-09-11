/**
 * Browser gestures shared by every end-to-end project.
 *
 * The review interface is one set of components from `@self-review/react`,
 * rendered by three front ends — the Electron renderer, the webapp fixture
 * harness and serve mode's browser client — so the gestures that drive it
 * belong in one place rather than once per project. Each project's helper
 * module keeps its own `Page` bookkeeping and calls in here.
 */
import type { Page } from '@playwright/test';

/**
 * Open the comment composer on one line by its gutter icon.
 *
 * The icon only exists while the row is hovered, and the composer opens on a
 * mousedown/mouseup pair rather than a click because the same handler drives
 * drag-to-select over a range. The mouseup is dispatched on `document`, where
 * the drag handler listens; a click on the icon alone leaves the selection
 * open and no composer appears.
 */
export async function triggerCommentIcon(
  page: Page,
  filePath: string,
  line: number,
  side: 'old' | 'new'
): Promise<void> {
  const section = page.locator(`[data-testid="file-section-${filePath}"]`);
  const gutter = section.locator(`[data-testid="${side}-line-${filePath}-${line}"]`);
  await gutter.hover();
  const icon = section.locator(`[data-testid="comment-icon-${side}-${line}"]`);
  await icon.waitFor({ state: 'visible', timeout: 5000 });
  await icon.dispatchEvent('mousedown');
  // Brief pause for React to register the mousedown before dispatching mouseup.
  // There's no observable intermediate DOM state between mousedown and mouseup,
  // so a short fixed delay is appropriate here.
  await page.waitForTimeout(150);
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  await page.locator('[data-testid="comment-input"]').waitFor({ state: 'visible', timeout: 5000 });
}
