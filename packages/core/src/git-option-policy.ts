// Exact spellings only. Unknown flags retain pass-through behavior, including negations.
// Optional values are attached only; required values may consume the next argv element.
interface GitDiffOptionPolicy {
  readonly value?: 'required' | 'attached';
  readonly writeCapable?: true;
  readonly unsupportedOutput?: 'always' | 'attached';
  readonly rediff?: 'drop' | 'relative';
}

const OPTION_POLICY: Readonly<Record<string, GitDiffOptionPolicy>> = {
  '--output': { value: 'required', writeCapable: true, unsupportedOutput: 'always' },
  '--ext-diff': { writeCapable: true },
  '--textconv': { writeCapable: true },
  '--src-prefix': { value: 'required' },
  '--dst-prefix': { value: 'required' },
  '--line-prefix': { value: 'required', unsupportedOutput: 'always' },
  '--output-indicator-new': { value: 'required', unsupportedOutput: 'always' },
  '--output-indicator-old': { value: 'required', unsupportedOutput: 'always' },
  '--output-indicator-context': { value: 'required', unsupportedOutput: 'always' },
  '--inter-hunk-context': { value: 'required' },
  // Preserve the existing warning policy for these attached stat parameters.
  '--stat-width': { value: 'required', unsupportedOutput: 'attached' },
  '--stat-name-width': { value: 'required', unsupportedOutput: 'attached' },
  '--stat-graph-width': { value: 'required', unsupportedOutput: 'attached' },
  '--stat-count': { value: 'required', unsupportedOutput: 'attached' },
  '--diff-algorithm': { value: 'required' },
  '--word-diff-regex': { value: 'required', unsupportedOutput: 'always' },
  '--ignore-matching-lines': { value: 'required' },
  '--anchored': { value: 'required' },
  '--diff-filter': { value: 'required' },
  '--find-object': { value: 'required' },
  '--rotate-to': { value: 'required', rediff: 'drop' },
  '--skip-to': { value: 'required', rediff: 'drop' },
  '--ws-error-highlight': { value: 'required' },
  '--color-moved-ws': { value: 'required', unsupportedOutput: 'always' },
  '-S': { value: 'required' },
  '-G': { value: 'required' },
  '-O': { value: 'required', rediff: 'drop' },
  '-I': { value: 'required' },
  '-l': { value: 'required' },
  '-U': { value: 'attached', rediff: 'drop' },
  '-B': { value: 'attached' },
  '-M': { value: 'attached' },
  '-C': { value: 'attached' },
  '-W': { rediff: 'drop' },
  '--unified': { value: 'attached', rediff: 'drop' },
  '--function-context': { rediff: 'drop' },
  '--no-function-context': { rediff: 'drop' },
  '--relative': { value: 'attached', rediff: 'relative' },
  '--no-relative': { rediff: 'relative' },
  '--stat': { value: 'attached', unsupportedOutput: 'always' },
  '--numstat': { unsupportedOutput: 'always' },
  '--shortstat': { unsupportedOutput: 'always' },
  '--dirstat': { value: 'attached', unsupportedOutput: 'always' },
  '--dirstat-by-file': { value: 'attached', unsupportedOutput: 'always' },
  '--cumulative': { unsupportedOutput: 'always' },
  '--summary': { unsupportedOutput: 'always' },
  '--name-only': { unsupportedOutput: 'always' },
  '--name-status': { unsupportedOutput: 'always' },
  '--raw': { unsupportedOutput: 'always' },
  '--patch-with-stat': { unsupportedOutput: 'always' },
  '--patch-with-raw': { unsupportedOutput: 'always' },
  '--compact-summary': { unsupportedOutput: 'always' },
  '--word-diff': { value: 'attached', unsupportedOutput: 'always' },
  '--color-words': { value: 'attached', unsupportedOutput: 'always' },
  '--color-moved': { value: 'attached', unsupportedOutput: 'always' },
  '--no-patch': { unsupportedOutput: 'always' },
  '-s': { unsupportedOutput: 'always' },
  '--exit-code': { unsupportedOutput: 'always' },
  '--quiet': { unsupportedOutput: 'always' },
  '--check': { unsupportedOutput: 'always' },
};

/** A missing entry means no known arity or restriction, never a rejected option. */
export function gitDiffOptionPolicy(name: string): GitDiffOptionPolicy {
  return Object.prototype.hasOwnProperty.call(OPTION_POLICY, name) ? OPTION_POLICY[name] : {};
}
