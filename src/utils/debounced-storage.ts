export type DebouncedCommitOptions = {
  commit: () => Promise<void>;
  idleMs: number;
  maxMs: number;
  waitUntil?: (promise: Promise<void>) => void;
};

export type DebouncedCommitController = {
  schedule: () => void;
  flush: () => Promise<void>;
  cancel: () => void;
};

export function createDebouncedCommit(
  options: DebouncedCommitOptions,
): DebouncedCommitController {
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingPromise: Promise<void> | undefined;
  let scheduled = false;
  const clearTimers = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = undefined;
    }
  };

  const flush = async (): Promise<void> => {
    if (!scheduled) {
      return;
    }

    scheduled = false;
    clearTimers();

    if (!pendingPromise) {
      pendingPromise = options.commit();
      options.waitUntil?.(pendingPromise);
    }

    try {
      await pendingPromise;
    } finally {
      pendingPromise = undefined;
    }
  };

  const schedule = () => {
    scheduled = true;

    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(() => {
      void flush();
    }, options.idleMs);

    if (!maxTimer) {
      maxTimer = setTimeout(() => {
        void flush();
      }, options.maxMs);
    }
  };

  const cancel = () => {
    scheduled = false;
    clearTimers();
  };

  return { schedule, flush, cancel };
}
