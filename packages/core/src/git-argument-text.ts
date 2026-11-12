// Pure argv text conversion. No shell expansion or execution is performed.

/** Scan the established quoting syntax once for both tolerant reads and strict admission. */
function scanGitDiffArgs(value: string): { args: string[]; syntaxError: string | null } {
  const args: string[] = [];
  let current = '';
  let started = false;
  let quote: "'" | '"' | null = null;
  let danglingEscape = false;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];

    if (quote === "'") {
      if (char === "'") quote = null;
      else current += char;
      continue;
    }

    if (quote === '"') {
      // Inside double quotes only the quote and the backslash are escapable;
      // every other backslash is a literal character, as in POSIX shells.
      if (char === '\\' && (value[i + 1] === '"' || value[i + 1] === '\\')) {
        current += value[++i];
      } else if (char === '"') {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      started = true;
      continue;
    }
    if (char === '\\' && i + 1 < value.length) {
      current += value[++i];
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (started) {
        args.push(current);
        current = '';
        started = false;
      }
      continue;
    }
    if (char === '\\') danglingEscape = true;
    current += char;
    started = true;
  }

  if (started) args.push(current);
  const syntaxError =
    quote !== null
      ? `unterminated ${quote === "'" ? 'single' : 'double'} quote`
      : danglingEscape
        ? 'trailing escape'
        : null;
  return { args, syntaxError };
}

/** Legacy/persisted review strings keep their best-effort malformed-input behavior. */
export function tokenizeGitDiffArgs(value: string): string[] {
  return scanGitDiffArgs(value).args;
}

/** Internal configuration admission only; never includes the input in its diagnostic. */
export function gitDiffArgsSyntaxError(value: string): string | null {
  return scanGitDiffArgs(value).syntaxError;
}

/** True when rendering this argument bare would lose its boundary. */
function needsQuoting(arg: string): boolean {
  return arg.length === 0 || /[\s'"\\]/.test(arg);
}

/**
 * Render argv as the single string a git diff source carries, such that
 * `tokenizeGitDiffArgs` recovers the exact argument list.
 *
 * Arguments that survive a bare round trip are written bare, so ordinary
 * invocations produce byte-identical output to a plain join and the
 * `git-diff-args` XML attribute does not change shape for them.
 */
export function formatGitDiffArgs(args: string[]): string {
  return args.map(arg => (needsQuoting(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg)).join(' ');
}
