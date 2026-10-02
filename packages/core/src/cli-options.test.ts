import { describe, it, expect } from 'vitest';
import { ApplicationOptionError, extractApplicationOptions } from './cli-options';

// The serve command line's flags, the larger of the two sets.
const SPEC = {
  valueFlags: {
    '--output': 'outputPath',
    '-o': 'outputPath',
    '--resume-from': 'resumeFrom',
  },
  booleanFlags: { '--help': 'help', '-h': 'help', '--version': 'version', '-v': 'version' },
} as const;

describe('extractApplicationOptions', () => {
  it('takes value flags in both forms and passes everything else to git in order', () => {
    const result = extractApplicationOptions(
      ['--staged', '--output', 'out/a.xml', 'main..feature', '--resume-from=prior.xml', '-h'],
      SPEC
    );

    expect(result.values).toEqual({ outputPath: 'out/a.xml', resumeFrom: 'prior.xml' });
    expect(result.flags).toEqual({ help: true, version: false });
    expect(result.rest).toEqual(['--staged', 'main..feature']);
  });

  it('stops reading application flags at --, which git gets along with what follows', () => {
    const result = extractApplicationOptions(
      ['HEAD~1', '--', '--output', 'x.xml', '--help', 'src/'],
      SPEC
    );

    expect(result.values).toEqual({ outputPath: null, resumeFrom: null });
    expect(result.flags.help).toBe(false);
    expect(result.rest).toEqual(['HEAD~1', '--', '--output', 'x.xml', '--help', 'src/']);
  });

  it("leaves a git option's separate value alone even when it is spelled like a flag", () => {
    // `-S --output` searches for the text `--output`; `--src-prefix -h` names a prefix.
    const result = extractApplicationOptions(['-S', '--output', '--src-prefix', '-h'], SPEC);

    expect(result.values.outputPath).toBeNull();
    expect(result.flags.help).toBe(false);
    expect(result.rest).toEqual(['-S', '--output', '--src-prefix', '-h']);
  });

  it('rejects a value flag with no value or an empty one, naming the flag', () => {
    expect(() => extractApplicationOptions(['--staged', '--output'], SPEC)).toThrow(
      new ApplicationOptionError('--output')
    );
    expect(() => extractApplicationOptions(['--output='], SPEC)).toThrow(
      /--output requires a file path argument/
    );
    expect(() => extractApplicationOptions(['-o', ''], SPEC)).toThrow(/-o requires/);
    expect(() => extractApplicationOptions(['--resume-from='], SPEC)).toThrow(
      /--resume-from requires/
    );
  });

  it('takes the last value when a flag repeats, and accepts a value that starts with a dash', () => {
    const result = extractApplicationOptions(['-o', 'a.xml', '--output', '-weird.xml'], SPEC);

    expect(result.values.outputPath).toBe('-weird.xml');
    expect(result.rest).toEqual([]);
  });

  it('does not read an unknown --name=value as a flag', () => {
    const result = extractApplicationOptions(['--unified=5', '--relative=sub'], SPEC);

    expect(result.rest).toEqual(['--unified=5', '--relative=sub']);
  });
});
