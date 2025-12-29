// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NodesRef, SelectorQuery } from '@lynx-js/types';

import { hydrationMap } from '../../snapshotInstanceHydrationMap.js';

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? K : never;
}[keyof T];

type ForwardableNodesRefMethod = Exclude<FunctionPropertyNames<NodesRef>, 'exec'>;

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
class RefProxy {
  private readonly refAttr: [snapshotInstanceId: number, expIndex: number];
  private task: RefTask | undefined;

  constructor(refAttr: [snapshotInstanceId: number, expIndex: number]) {
    this.refAttr = refAttr;
    this.task = undefined;

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (
          typeof prop === 'symbol'
          || prop === 'then'
          || prop in target
          || typeof prop !== 'string'
        ) {
          return Reflect.get(target, prop, receiver);
        }

        const forward = <K extends ForwardableNodesRefMethod>(method: K) => {
          return (...args: Parameters<NodesRef[K]>) => {
            return new RefProxy(target.refAttr).setTask(method, args);
          };
        };

        return forward(prop as ForwardableNodesRefMethod);
      },
    }) as RefProxy;
  }

  private setTask<K extends ForwardableNodesRefMethod>(
    method: K,
    args: Parameters<NodesRef[K]>,
  ): this {
    this.task = (nodesRef) => {
      const nodesRefMethod = nodesRef[method] as (...params: Parameters<NodesRef[K]>) => SelectorQuery;
      return nodesRefMethod.apply(nodesRef, args);
    };
    return this;
  }

  exec(): void {
    runOrDelay(() => {
      const realRefId = hydrationMap.get(this.refAttr[0]) ?? this.refAttr[0];
      const refSelector = `[react-ref-${realRefId}-${this.refAttr[1]}]`;
      this.task!(lynx.createSelectorQuery().select(refSelector)).exec();
    });
  }
}

type RefProxyForwardedMethods = {
  [K in ForwardableNodesRefMethod]: (...args: Parameters<NodesRef[K]>) => RefProxy;
};

interface RefProxy extends RefProxyForwardedMethods {}

/**
 * @internal
 */
export { RefProxy, runDelayedUiOps, shouldDelayUiOps };
