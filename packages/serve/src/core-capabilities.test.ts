import { expect, it, vi } from 'vitest';
import * as core from '@self-review/core';
import { reportCoreCompatibility } from './core-capabilities';

it('keeps current core startup stderr unchanged', () => {
  const report = vi.fn();
  reportCoreCompatibility(report, core);
  expect(report).not.toHaveBeenCalled();
});

it('reports the known previous-core limitations without claiming writes were refused', () => {
  const report = vi.fn();
  reportCoreCompatibility(report, {});
  expect(report.mock.calls.map(([message]) => message)).toEqual([
    expect.stringContaining('synchronous startup probe'),
    expect.stringContaining(
      'Check the destination after a lost response; never replay automatically'
    ),
    expect.stringContaining('local loading does not support the startup signal'),
    expect.stringContaining('HTTP body limit does not bound resumed assets read from disk'),
  ]);
});
