import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { guardAgainstOrphaning } from './orphan-guard';

describe('guardAgainstOrphaning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not watch a directly-invoked serve process', () => {
    const onOrphaned = vi.fn();
    const stop = guardAgainstOrphaning(onOrphaned, {
      isRelaunchedChild: () => false,
      readParentPid: () => 1,
      intervalMs: 10,
    });

    // Null means nothing is watching: outliving the shell that started it is
    // legitimate for a directly-invoked process, so no guard may be armed.
    expect(stop).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(onOrphaned).not.toHaveBeenCalled();
  });

  it('shuts down once the launcher is gone, and only once', () => {
    let parentPid = 4242;
    const onOrphaned = vi.fn();
    guardAgainstOrphaning(onOrphaned, {
      isRelaunchedChild: () => true,
      readParentPid: () => parentPid,
      intervalMs: 10,
    });

    vi.advanceTimersByTime(100);
    expect(onOrphaned).not.toHaveBeenCalled();

    // The launcher died; the kernel reparented us.
    parentPid = 1;
    vi.advanceTimersByTime(10);
    expect(onOrphaned).toHaveBeenCalledTimes(1);

    // Still exactly once well after the fact — a repeated callback would mean
    // repeated shutdown attempts.
    vi.advanceTimersByTime(1000);
    expect(onOrphaned).toHaveBeenCalledTimes(1);
  });

  it('detects reparenting to a subreaper, not just to init', () => {
    let parentPid = 4242;
    const onOrphaned = vi.fn();
    guardAgainstOrphaning(onOrphaned, {
      isRelaunchedChild: () => true,
      readParentPid: () => parentPid,
      intervalMs: 10,
    });

    // Under a subreaper the new parent is neither the launcher nor init, which
    // is why this compares against the pid recorded at startup.
    parentPid = 99;
    vi.advanceTimersByTime(10);
    expect(onOrphaned).toHaveBeenCalledTimes(1);
  });

  it('stops watching when told to', () => {
    let parentPid = 4242;
    const onOrphaned = vi.fn();
    const stop = guardAgainstOrphaning(onOrphaned, {
      isRelaunchedChild: () => true,
      readParentPid: () => parentPid,
      intervalMs: 10,
    });

    stop?.();
    parentPid = 1;
    vi.advanceTimersByTime(1000);
    expect(onOrphaned).not.toHaveBeenCalled();
  });
});
