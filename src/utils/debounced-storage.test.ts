import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDebouncedCommit } from "./debounced-storage";

describe("createDebouncedCommit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("flushes after the idle delay", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const waitUntil = vi.fn();
    const controller = createDebouncedCommit({
      commit,
      idleMs: 100,
      maxMs: 500,
      waitUntil,
    });

    controller.schedule();

    await vi.advanceTimersByTimeAsync(99);
    expect(commit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("flushes once the max window elapses even with frequent schedules", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const controller = createDebouncedCommit({
      commit,
      idleMs: 200,
      maxMs: 600,
    });

    const interval = 150;
    for (let i = 0; i < 3; i += 1) {
      controller.schedule();
      await vi.advanceTimersByTimeAsync(interval);
    }

    controller.schedule();
    await vi.advanceTimersByTimeAsync(600 - interval * 3);

    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("flush resolves immediately when no work is scheduled", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const controller = createDebouncedCommit({
      commit,
      idleMs: 100,
      maxMs: 200,
    });

    await controller.flush();

    expect(commit).not.toHaveBeenCalled();
  });
});
