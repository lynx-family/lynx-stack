// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const MAX_BENCH_GROUPS = 8;
export const MAX_BENCH_JUDGE_CONCURRENCY = 2;

export function benchInFlightLimit(groupCount: number): number {
  return Math.max(1, groupCount) + MAX_BENCH_JUDGE_CONCURRENCY + 1;
}

/** FIFO admission; cancellation removes queued work without releasing active work early. */
export class BenchTaskPool {
  private active = 0;
  private readonly waiting = new Set<() => void>();

  constructor(private readonly concurrency: number) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error('Bench concurrency must be a positive integer.');
    }
  }

  public async acquire(signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const admit = () => {
        signal?.removeEventListener('abort', abort);
        this.waiting.delete(admit);
        this.active++;
        resolve();
      };
      const abort = () => {
        this.waiting.delete(admit);
        reject(
          signal?.reason instanceof Error
            ? signal.reason
            : new Error('Bench task cancelled.'),
        );
      };
      if (this.active < this.concurrency) {
        admit();
      } else {
        this.waiting.add(admit);
        signal?.addEventListener('abort', abort, { once: true });
      }
    });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.waiting.values().next().value?.();
    };
  }

  public async run<T>(
    task: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const release = await this.acquire(signal);
    try {
      signal?.throwIfAborted();
      return await task();
    } finally {
      release();
    }
  }
}

export interface BenchJudgeScheduling {
  evaluation: BenchTaskPool;
}
