import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

vi.mock('fs');
vi.mock('os');
vi.mock('path');

describe('config', () => {
  const mockHomedir = '/home/user';
  const mockCwd = '/workspace/project';
  const originalCwd = process.cwd;

  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue(mockHomedir);
    process.cwd = vi.fn().mockReturnValue(mockCwd);
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.cwd = originalCwd;
  });

  describe('loadConfig', () => {
    it('returns default config when no config files exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = loadConfig();

      expect(config.theme).toBe('system');
      expect(config.diffView).toBe('split');
      expect(config.fontSize).toBe(14);
      expect(config.outputFile).toBe('./review.xml');
      expect(config.categories).toHaveLength(5);
      expect(config.categories[0].name).toBe('question');
      expect(config.wordWrap).toBe(true);
    });

    it('loads user-level config from ~/.config/self-review/config.yaml', () => {
      const mockYaml = `
theme: dark
font-size: 16
`;
      vi.mocked(fs.existsSync).mockImplementation(filepath => {
        return filepath === `${mockHomedir}/.config/self-review/config.yaml`;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.theme).toBe('dark');
      expect(config.fontSize).toBe(16);
      expect(config.diffView).toBe('split'); // Still has default
    });

    it('loads project-level config from .self-review.yaml', () => {
      const mockYaml = `
diff-view: unified
show-untracked: false
`;
      vi.mocked(fs.existsSync).mockImplementation(filepath => {
        return filepath === `${mockCwd}/.self-review.yaml`;
      });
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.diffView).toBe('unified');
      expect(config.showUntracked).toBe(false);
      expect(config.theme).toBe('system'); // Still has default
    });

    it('merges user and project configs with project taking precedence', () => {
      const userYaml = `
theme: dark
font-size: 16
diff-view: unified
`;
      const projectYaml = `
theme: light
font-size: 18
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(filepath => {
        if (filepath.includes('.config/self-review')) {
          return userYaml;
        }
        return projectYaml;
      });

      const config = loadConfig();

      // Project overrides user
      expect(config.theme).toBe('light');
      expect(config.fontSize).toBe(18);
      expect(config.diffView).toBe('unified'); // From user config
    });

    it('loads custom categories from config', () => {
      const mockYaml = `
categories:
  - name: custom-bug
    description: My custom bug category
    color: '#ff0000'
  - name: perf
    description: Performance issue
    color: '#00ff00'
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.categories).toHaveLength(2);
      expect(config.categories[0].name).toBe('custom-bug');
      expect(config.categories[1].name).toBe('perf');
    });

    it('filters out invalid category entries', () => {
      const mockYaml = `
categories:
  - name: valid
    description: Valid category
    color: '#ff0000'
  - name: invalid-missing-desc
    color: '#00ff00'
  - invalid: true
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.categories).toHaveLength(1);
      expect(config.categories[0].name).toBe('valid');
    });

    it('validates theme values and rejects invalid ones', () => {
      const mockYaml = `
theme: invalid-theme
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.theme).toBe('system'); // Falls back to default
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid theme value')
      );
    });

    it('validates diff-view values and rejects invalid ones', () => {
      const mockYaml = `
diff-view: invalid-view
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.diffView).toBe('split'); // Falls back to default
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid diff-view value')
      );
    });

    it('handles invalid YAML gracefully', () => {
      const mockYaml = `this is not: valid: yaml: syntax:::`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      // Should return defaults
      expect(config.theme).toBe('system');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Failed to load')
      );
    });

    it('loads ignore patterns from config', () => {
      const mockYaml = `
ignore:
  - '*.test.ts'
  - 'dist/**'
  - 'node_modules/**'
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.ignore).toHaveLength(3);
      expect(config.ignore).toContain('*.test.ts');
      expect(config.ignore).toContain('dist/**');
    });

    it('filters out non-string ignore patterns', () => {
      const mockYaml = `
ignore:
  - '*.test.ts'
  - 123
  - true
  - 'valid-pattern'
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.ignore).toHaveLength(2);
      expect(config.ignore).toContain('*.test.ts');
      expect(config.ignore).toContain('valid-pattern');
    });

    it('loads default-diff-args from config', () => {
      const mockYaml = `
default-diff-args: '--staged --ignore-space-change'
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.defaultDiffArgs).toBe('--staged --ignore-space-change');
    });

    it('arrays replace defaults rather than merging', () => {
      const mockYaml = `
categories:
  - name: only-this
    description: Only category
    color: '#ff0000'
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      // Should have only 1 category, not 6 (1 custom + 5 defaults)
      expect(config.categories).toHaveLength(1);
      expect(config.categories[0].name).toBe('only-this');
    });

    it('loads word-wrap from config', () => {
      const mockYaml = `word-wrap: false`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.wordWrap).toBe(false);
    });

    it('ignores non-boolean word-wrap values', () => {
      const mockYaml = `word-wrap: "yes"`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.wordWrap).toBe(true);
    });

    it('loads output-file from config', () => {
      const mockYaml = `output-file: './custom-output.xml'`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.outputFile).toBe('./custom-output.xml');
    });

    it('project config output-file takes precedence over user config', () => {
      const userYaml = `output-file: './user.xml'`;
      const projectYaml = `output-file: './project.xml'`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(filepath => {
        if (filepath.includes('.config/self-review')) {
          return userYaml;
        }
        return projectYaml;
      });

      const config = loadConfig();

      expect(config.outputFile).toBe('./project.xml');
    });

    it('ignores empty output-file and uses default', () => {
      const mockYaml = `output-file: ''`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const config = loadConfig();

      expect(config.outputFile).toBe('./review.xml');
    });
  });
});
