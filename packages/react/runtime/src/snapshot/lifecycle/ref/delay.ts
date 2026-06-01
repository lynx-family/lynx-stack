// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { SelectorRefProxy } from '../../../core/ref.js';
import type { RefProxyForwardedMethods } from '../../../core/ref.js';
import { hydrationMap } from '../../snapshot/snapshotInstanceHydrationMap.js';

/**
 * A flag to indicate whether UI operations should be delayed.
 * When set to true, UI operations will be queued in the `delayedUiOps` array
 * and executed later when `runDelayedUiOps` is called.
 * This is used before hydration to ensure UI operations are batched
 * and executed at the appropriate time.
 */
const shouldDelayUiOps = { value: true };

/**
 * An array of functions that will be executed later when `runDelayedUiOps` is called.
 * These functions contain UI operations that need to be delayed.
 */
const delayedUiOps: (() => void)[] = [];

/**
 * Runs a task either immediately or delays it based on the `shouldDelayUiOps` flag.
 * @param task - The function to execute.
 */
function runOrDelay(task: () => void): void {
  if (shouldDelayUiOps.value) {
    delayedUiOps.push(task);
  } else {
    task();
  }
}

/**
 * Executes all delayed UI operations.
 */
function runDelayedUiOps(): void {
  const tasks = delayedUiOps.slice();
  delayedUiOps.length = 0;
  shouldDelayUiOps.value = false;

  for (const task of tasks) {
    task();
  }
}

/**
 * A proxy class designed for managing and executing reference-based tasks.
 * It delays the execution of tasks until hydration is complete.
 */
class RefProxy extends SelectorRefProxy<RefProxy> {
  private readonly refAttr: [snapshotInstanceId: number, expIndex: number];

  constructor(refAttr: [snapshotInstanceId: number, expIndex: number]) {
    super();
    this.refAttr = refAttr;

    return this.createProxy();
  }

  protected createProxyTarget(): RefProxy {
    return new RefProxy(this.refAttr);
  }

  protected runOrDelay(task: () => void): void {
    runOrDelay(task);
  }

  get selector(): string {
    const realRefId = hydrationMap.get(this.refAttr[0]) ?? this.refAttr[0];
    return `[react-ref-${realRefId}-${this.refAttr[1]}]`;
  }
}

interface RefProxy extends RefProxyForwardedMethods<RefProxy> {}

/**
 * @internal
 */
export { RefProxy, runDelayedUiOps, shouldDelayUiOps };
