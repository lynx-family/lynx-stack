// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NodesRef, SelectorQuery } from '@lynx-js/types';

import { hydrationMap } from '../../snapshotInstanceHydrationMap.js';

type RefTask = (nodesRef: NodesRef) => SelectorQuery;

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
  for (const task of delayedUiOps) {
    task();
  }
  shouldDelayUiOps.value = false;
  delayedUiOps.length = 0;
}

/**
 * A proxy class designed for managing and executing reference-based tasks.
 * It delays the execution of tasks until hydration is complete.
 */
class RefProxy {
  private readonly refAttr: [snapshotInstanceId: number, expIndex: number];
  private task: RefTask | undefined;

  constructor(refAttr: [snapshotInstanceId: number, expIndex: number]) {
    this.refAttr = refAttr;
  }

  private setTask<K extends keyof NodesRef>(
    method: K,
    args: Parameters<NodesRef[K]>,
  ): this {
    this.task = (nodesRef) => {
      return (nodesRef[method] as unknown as (...args: any[]) => SelectorQuery)(...args);
    };
    return this;
  }

  invoke(...args: Parameters<NodesRef['invoke']>): RefProxy {
    return new RefProxy(this.refAttr).setTask('invoke', args);
  }

  path(...args: Parameters<NodesRef['path']>): RefProxy {
    return new RefProxy(this.refAttr).setTask('path', args);
  }

  fields(...args: Parameters<NodesRef['fields']>): RefProxy {
    return new RefProxy(this.refAttr).setTask('fields', args);
  }

  setNativeProps(...args: Parameters<NodesRef['setNativeProps']>): RefProxy {
    return new RefProxy(this.refAttr).setTask('setNativeProps', args);
  }

  exec(): void {
    runOrDelay(() => {
      const realRefId = hydrationMap.get(this.refAttr[0]) ?? this.refAttr[0];
      const refSelector = `[react-ref-${realRefId}-${this.refAttr[1]}]`;
      this.task!(lynx.createSelectorQuery().select(refSelector)).exec();
    });
  }
}

/**
 * @internal
 */
export { RefProxy, runDelayedUiOps, shouldDelayUiOps };
