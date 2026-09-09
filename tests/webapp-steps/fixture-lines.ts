/**
 * Fixture-side lookups for the webapp diff. No Playwright import, so the
 * lookup can be checked on its own.
 */
import { fixtureFiles } from '../webapp/fixture-data';

/**
 * The fixture's own text for a diff line. Comparing an editor against this
 * pins its content to the requested source. Comparing two editors against
 * each other only proves they agree, which any wrong line satisfies too.
 */
export function fixtureLineContent(
  filePath: string,
  line: number,
  side: 'old' | 'new'
): string {
  const file = fixtureFiles.find(f => (f.newPath || f.oldPath) === filePath);
  if (!file) throw new Error(`No fixture file for ${filePath}`);
  const contents = file.hunks
    .flatMap(hunk => hunk.lines)
    .filter(l => (side === 'old' ? l.oldLineNumber : l.newLineNumber) === line)
    .map(l => l.content);
  if (contents.length !== 1) {
    throw new Error(
      `Expected one ${side} line ${line} in ${filePath}, found ${contents.length}`
    );
  }
  return contents[0];
}
