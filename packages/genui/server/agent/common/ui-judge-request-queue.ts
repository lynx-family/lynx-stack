// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BenchTaskPool } from '../../service/common/bench/concurrency.js';
import {
  resolveBenchRetryDelay,
  waitForBenchRetry,
} from '../../service/common/bench/retry.js';
import type { BenchRetrySleep } from '../../service/common/bench/retry.js';

const MAX_ATTEMPTS = 3;
const RATE_LIMIT_DELAY_MS = 60_000;

/** Bound and pace individual model calls across screenshots and Bench jobs. */
export class UiJudgeRequestQueue {
  private readonly requests = new BenchTaskPool(2);
  private readonly starts = new BenchTaskPool(1);
  private nextStartAt = 0;

  constructor(
    private readonly options: {
      /** Test seams; production starts at most one request per second. */
      intervalMs?: number;
      now?: () => number;
      sleep?: BenchRetrySleep;
    } = {},
  ) {}

  private now(): number {
    return this.options.now?.() ?? performance.now();
  }

  public async run<T>(
    task: () => Promise<T>,
    signal?: AbortSignal,
    onRetry?: (delayMs: number) => void,
  ): Promise<T> {
    for (let attempt = 1;; attempt++) {
      let retryDelay: number | undefined;
      try {
        return await this.requests.run(async () => {
          await this.starts.run(async () => {
            // Another in-flight call can extend the shared cooldown while we wait.
            while (this.nextStartAt > this.now()) {
              await waitForBenchRetry(
                this.nextStartAt - this.now(),
                signal,
                this.options.sleep,
              );
            }
            signal?.throwIfAborted();
            this.nextStartAt = this.now() + (this.options.intervalMs ?? 1_000);
          }, signal);
          signal?.throwIfAborted();
          try {
            return await task();
          } catch (error) {
            if (!signal?.aborted) {
              retryDelay = resolveBenchRetryDelay(error, attempt, {
                rateLimitDelayMs: RATE_LIMIT_DELAY_MS,
              });
              if (retryDelay !== undefined) {
                // Publish the cooldown before releasing a slot to another call.
                this.nextStartAt = Math.max(
                  this.nextStartAt,
                  this.now() + retryDelay,
                );
              }
            }
            throw error;
          }
        }, signal);
      } catch (error) {
        if (
          signal?.aborted || retryDelay === undefined || attempt >= MAX_ATTEMPTS
        ) {
          throw error;
        }
        onRetry?.(retryDelay);
      }
    }
  }
}

const queues = new Map<string, UiJudgeRequestQueue>();

export function getUiJudgeRequestQueue(
  baseURL: string,
  model: string,
): UiJudgeRequestQueue {
  // Resolve public aliases before keying; credentials never enter queue keys/logs.
  const key = JSON.stringify([baseURL.replace(/\/+$/u, ''), model]);
  let queue = queues.get(key);
  if (!queue) {
    queue = new UiJudgeRequestQueue();
    queues.set(key, queue);
  }
  return queue;
}
