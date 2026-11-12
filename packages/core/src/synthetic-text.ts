// Bounded text accounting shared by patch and structured emission.
import { createRepresentationBudget } from './input-budgets';

/** Decode once for either output; retain CR, BOM and UTF-8 replacement semantics. */
export function* projectText(
  content: Buffer,
  representation: ReturnType<typeof createRepresentationBudget>
) {
  let lineCount = 0;
  // Count before decoding or allocating any line strings/objects. A byte chunk also bounds
  // checkpoint spacing for a single long line. UTF-8 never embeds LF in a multibyte sequence.
  for (let start = 0; start < content.length; start += 64 * 1024) {
    let count = 0;
    const end = Math.min(start + 64 * 1024, content.length);
    for (let i = start; i < end; i++) if (content[i] === 0x0a) count++;
    representation.addLines(count);
    lineCount += count;
    yield;
  }
  const missingNewline = content.length > 0 && content[content.length - 1] !== 0x0a;
  if (missingNewline) {
    representation.addLines(1);
    lineCount++;
  }
  return {
    text: content.toString('utf-8'),
    lineCount,
    header: `@@ -0,0 +1,${lineCount} @@`,
    missingNewline,
  };
}

export interface ProjectedText {
  text: string;
  lineCount: number;
  header: string;
  missingNewline: boolean;
}
