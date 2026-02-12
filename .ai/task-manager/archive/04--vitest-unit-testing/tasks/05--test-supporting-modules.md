---
id: 5
group: 'supporting-tests'
dependencies: [1]
status: 'completed'
created: '2026-02-12'
completed: '2026-02-12'
skills:
  - vitest
  - typescript
---

# Test Supporting Modules

## Objective

Write unit tests for supporting modules (config, CLI, git, useDiffNavigation) to reach the 50-60%
coverage target. These modules support the core functionality but are not as critical as the
priority modules.

## Skills Required

- **vitest**: Write tests with mocking for filesystem, child processes, and browser APIs
- **typescript**: Test TypeScript modules with complex mocking requirements

## Acceptance Criteria

- [ ] Test file created at `src/main/config.test.ts` for YAML config loading and merging
- [ ] Test file created at `src/main/cli.test.ts` for CLI argument parsing
- [ ] Test file created at `src/main/git.test.ts` for git command construction
- [ ] Test file created at `src/renderer/hooks/useDiffNavigation.test.ts` for scroll sync logic
- [ ] Tests mock external dependencies appropriately (fs, child_process, DOM APIs)
- [ ] Tests focus on meaningful business logic, not trivial operations
- [ ] All tests pass with `npm run test:unit` (both main and renderer)
- [ ] Combined with other test suites, reaches 50-60% overall coverage

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

### Modules to Test

1. **config.ts** (`src/main/config.ts`): YAML config loading, merging user config with defaults
2. **cli.ts** (`src/main/cli.ts`): CLI argument parsing, pass-through to git diff
3. **git.ts** (`src/main/git.ts`): Git command construction and execution
4. **useDiffNavigation.ts** (`src/renderer/hooks/useDiffNavigation.ts`): Scroll sync and file
   navigation

### Test Focus

**IMPORTANT**: Write a few tests, mostly integration. Focus on meaningful business logic:

- **config.ts**: Test config merging logic, default values, YAML parsing
- **cli.ts**: Test argument parsing and validation (if any)
- **git.ts**: Test command construction (mock child_process)
- **useDiffNavigation.ts**: Test navigation state and scroll logic (mock DOM)

### Mocking Strategy

- **Filesystem (config.ts)**: Mock `fs.readFileSync` for YAML files
- **Child Process (git.ts)**: Mock `child_process.spawn` or `exec`
- **Process Args (cli.ts)**: Mock `process.argv`
- **DOM APIs (useDiffNavigation.ts)**: jsdom provides DOM, but may need to mock scroll behavior

## Input Dependencies

- Task 1: Vitest infrastructure must be set up
- Source modules: `src/main/config.ts`, `src/main/cli.ts`, `src/main/git.ts`,
  `src/renderer/hooks/useDiffNavigation.ts`
- Mock libraries: Vitest's built-in mocking (`vi.mock()`)

## Output Artifacts

- `src/main/config.test.ts`: Tests for config loading and merging
- `src/main/cli.test.ts`: Tests for CLI argument parsing
- `src/main/git.test.ts`: Tests for git command construction
- `src/renderer/hooks/useDiffNavigation.test.ts`: Tests for navigation hook
- Passing tests verifiable with `npm run test:unit`

## Implementation Notes

<details>
<summary>Testing Approach and Examples</summary>

**IMPORTANT**: Write a few tests, mostly integration. Don't over-test simple operations. Focus on
the custom business logic in these modules.

### Meaningful Test Strategy Guidelines

**Definition of "Meaningful Tests":** Tests that verify custom business logic, critical paths, and
edge cases specific to the application. Focus on testing YOUR code, not the framework or library
functionality.

**When TO Write Tests:**

- Custom business logic and algorithms (✅ config merging, git command construction)
- Critical user workflows and data transformations
- Edge cases and error conditions for core functionality
- Integration points between different system components

**When NOT to Write Tests:**

- Third-party library functionality (YAML parsing library, child_process)
- Framework features
- Simple CRUD operations without custom logic
- Getter/setter methods or basic property access
- Configuration files or static data
- Obvious functionality that would break immediately if incorrect

### Example: config.test.ts

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, mergeConfig } from './config';
import * as fs from 'fs';

vi.mock('fs');

describe('config', () => {
  describe('loadConfig', () => {
    it('loads user config from .self-review.yml', () => {
      const mockYaml = `
theme: dark
categories:
  - name: bug
    color: red
`;
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const config = loadConfig('/repo/path');

      expect(config.theme).toBe('dark');
      expect(config.categories).toHaveLength(1);
      expect(config.categories[0].name).toBe('bug');
    });

    it('returns default config when user config does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = loadConfig('/repo/path');

      expect(config.theme).toBe('light'); // Default
      expect(config.categories).toBeDefined(); // Has default categories
    });

    it('merges user config with defaults', () => {
      const mockYaml = `
theme: dark
`;
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const config = loadConfig('/repo/path');

      expect(config.theme).toBe('dark'); // User override
      expect(config.categories).toBeDefined(); // Still has default categories
    });
  });

  describe('mergeConfig', () => {
    it('deep merges user config with defaults', () => {
      const defaults = {
        theme: 'light',
        categories: [
          { name: 'bug', color: 'red' },
          { name: 'feature', color: 'blue' },
        ],
      };

      const userConfig = {
        theme: 'dark',
        categories: [
          { name: 'bug', color: 'orange' }, // Override bug color
        ],
      };

      const merged = mergeConfig(defaults, userConfig);

      expect(merged.theme).toBe('dark');
      expect(merged.categories).toHaveLength(1); // User categories replace defaults
      expect(merged.categories[0].color).toBe('orange');
    });
  });
});
```

### Example: cli.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseArgs } from './cli';

describe('cli', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('parses --staged flag', () => {
    process.argv = ['node', 'self-review', '--staged'];

    const args = parseArgs();

    expect(args.gitArgs).toEqual(['--staged']);
  });

  it('passes through git diff arguments', () => {
    process.argv = ['node', 'self-review', 'main..feature'];

    const args = parseArgs();

    expect(args.gitArgs).toEqual(['main..feature']);
  });

  it('handles --resume-from flag', () => {
    process.argv = ['node', 'self-review', '--resume-from', 'review.xml', '--staged'];

    const args = parseArgs();

    expect(args.resumeFrom).toBe('review.xml');
    expect(args.gitArgs).toEqual(['--staged']);
  });

  it('returns empty gitArgs when no arguments provided', () => {
    process.argv = ['node', 'self-review'];

    const args = parseArgs();

    expect(args.gitArgs).toEqual([]);
  });
});
```

### Example: git.test.ts

```typescript
import { describe, it, expect, vi } from 'vitest';
import { runGitDiff } from './git';
import * as child_process from 'child_process';

vi.mock('child_process');

describe('git', () => {
  it('constructs git diff command with arguments', async () => {
    const mockSpawn = vi.fn().mockReturnValue({
      stdout: { on: vi.fn((event, cb) => event === 'data' && cb('diff output')) },
      stderr: { on: vi.fn() },
      on: vi.fn((event, cb) => event === 'close' && cb(0)),
    });

    vi.mocked(child_process.spawn).mockImplementation(mockSpawn);

    await runGitDiff(['--staged']);

    expect(mockSpawn).toHaveBeenCalledWith('git', ['diff', '--staged'], expect.any(Object));
  });

  it('handles git command errors', async () => {
    const mockSpawn = vi.fn().mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn((event, cb) => event === 'data' && cb('error message')) },
      on: vi.fn((event, cb) => event === 'close' && cb(1)),
    });

    vi.mocked(child_process.spawn).mockImplementation(mockSpawn);

    await expect(runGitDiff(['--invalid'])).rejects.toThrow();
  });

  it('passes repository path as cwd', async () => {
    const mockSpawn = vi.fn().mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event, cb) => event === 'close' && cb(0)),
    });

    vi.mocked(child_process.spawn).mockImplementation(mockSpawn);

    await runGitDiff(['--staged'], '/repo/path');

    expect(mockSpawn).toHaveBeenCalledWith(
      'git',
      ['diff', '--staged'],
      expect.objectContaining({ cwd: '/repo/path' })
    );
  });
});
```

### Example: useDiffNavigation.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiffNavigation } from './useDiffNavigation';

describe('useDiffNavigation', () => {
  it('tracks current file index', () => {
    const files = ['file1.ts', 'file2.ts', 'file3.ts'];
    const { result } = renderHook(() => useDiffNavigation(files));

    expect(result.current.currentFileIndex).toBe(0);

    act(() => {
      result.current.goToNextFile();
    });

    expect(result.current.currentFileIndex).toBe(1);
  });

  it('wraps around when navigating past last file', () => {
    const files = ['file1.ts', 'file2.ts'];
    const { result } = renderHook(() => useDiffNavigation(files));

    act(() => {
      result.current.goToNextFile();
      result.current.goToNextFile(); // Go past end
    });

    expect(result.current.currentFileIndex).toBe(0); // Wrapped around
  });

  it('handles goToPreviousFile', () => {
    const files = ['file1.ts', 'file2.ts'];
    const { result } = renderHook(() => useDiffNavigation(files));

    act(() => {
      result.current.goToNextFile();
    });

    expect(result.current.currentFileIndex).toBe(1);

    act(() => {
      result.current.goToPreviousFile();
    });

    expect(result.current.currentFileIndex).toBe(0);
  });

  it('navigates to specific file by path', () => {
    const files = ['file1.ts', 'file2.ts', 'file3.ts'];
    const { result } = renderHook(() => useDiffNavigation(files));

    act(() => {
      result.current.goToFile('file3.ts');
    });

    expect(result.current.currentFileIndex).toBe(2);
  });

  it('no-op when navigating to non-existent file', () => {
    const files = ['file1.ts', 'file2.ts'];
    const { result } = renderHook(() => useDiffNavigation(files));

    act(() => {
      result.current.goToFile('non-existent.ts');
    });

    expect(result.current.currentFileIndex).toBe(0); // No change
  });
});
```

### Tips

1. **Mock External Dependencies**: Use `vi.mock()` for fs, child_process, etc.
2. **Focus on Logic**: Test your custom logic, not library functionality
3. **Don't Over-Test**: These are supporting modules—write enough tests to be confident, not
   exhaustive
4. **Integration Over Unit**: Test how modules work together rather than isolated functions
5. **Skip Trivial Code**: Don't test simple getters, setters, or pass-through functions

### Running Tests

```bash
# Run main process supporting tests
npm run test:unit:main -- config.test.ts
npm run test:unit:main -- cli.test.ts
npm run test:unit:main -- git.test.ts

# Run renderer supporting tests
npm run test:unit:renderer -- useDiffNavigation.test.ts

# Check overall coverage
npm run test:coverage
```

</details>
