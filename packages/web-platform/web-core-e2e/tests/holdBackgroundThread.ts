// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Page } from '@playwright/test';

/**
 * Hold the background thread, so what is on screen is the main thread's own
 * frame.
 *
 * The RPC hands the background worker its `MessagePort` in the first message
 * it posts, so buffering that message leaves the background thread with
 * nothing to run. Only the `lynx-bg` worker is held — Lynx for Web also runs
 * a *decode* worker, and holding that one stalls the template itself, which
 * would leave the page blank for the wrong reason.
 *
 * Buffering the arguments rather than the worker keeps `new Worker()`
 * synchronous, and nothing is transferred until the flush, so transferables
 * are still neutered exactly once.
 *
 * Idempotent, and it has to be. A page that installs this twice wraps its own
 * wrapper: the second `Worker` subclass extends the first, and the second
 * release then flushes *into* the first hold, which is still armed and holds
 * everything again. Nothing ever reaches the background thread, and the
 * deadlock is invisible until a test navigates a second time.
 *
 * `background-island.spec.ts` and `bgmatrix.capture.spec.ts` still carry
 * their own copies, from before this module existed; they navigate once per
 * test, so the deadlock above cannot reach them. Folding them in here is a
 * follow-up, kept out of this change because both files are moving.
 */
export async function holdBackgroundThread(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const installed = '__releaseBackgroundThread';
    if (installed in globalThis) {
      return;
    }
    const backgroundWorkers = new WeakSet<Worker>();
    const held: { target: Worker; args: unknown[] }[] = [];

    const OriginalWorker = globalThis.Worker;
    globalThis.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (options?.name === 'lynx-bg') {
          backgroundWorkers.add(this);
        }
      }
    } as typeof Worker;

    const originalPostMessage = OriginalWorker.prototype.postMessage;
    OriginalWorker.prototype.postMessage = function(
      this: Worker,
      ...args: unknown[]
    ) {
      if (backgroundWorkers.has(this)) {
        held.push({ target: this, args });
        return;
      }
      (originalPostMessage as (...a: unknown[]) => void).apply(this, args);
    } as typeof Worker.prototype.postMessage;

    (globalThis as unknown as { __releaseBackgroundThread: () => number })
      .__releaseBackgroundThread = () => {
        const pending = held.splice(0);
        for (const { target, args } of pending) {
          (originalPostMessage as (...a: unknown[]) => void).apply(
            target,
            args,
          );
        }
        for (const worker of pending) {
          backgroundWorkers.delete(worker.target);
        }
        return pending.length;
      };
  });
}

/** Let the background thread start, and report how many messages it got. */
export async function releaseBackgroundThread(page: Page): Promise<number> {
  return await page.evaluate(() =>
    (globalThis as unknown as { __releaseBackgroundThread: () => number })
      .__releaseBackgroundThread()
  );
}
