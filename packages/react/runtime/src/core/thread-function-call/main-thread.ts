// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { onFunctionCall } from './return-value.js';
import { getCurrentRootContext, onRootContextSwitch } from '../../render-context.js';
import { isSdkVersionGt } from '../../utils.js';
import { WorkletEvents } from '../../worklet-runtime/bindings/events.js';
import type { RunWorkletCtxData } from '../../worklet-runtime/bindings/events.js';
import type { Worklet } from '../../worklet-runtime/bindings/types.js';
import { registerBackgroundFunctionCtx } from '../background-function/run-on-background.js';
import { isMainThreadFunction } from '../main-thread-function.js';
import { isMtsEnabled } from '../mts-capability.js';
import { getPageLynx } from '../page-lynx.js';

interface RunOnMainThreadOptions {
  shouldDispatchRunOnMainThreadDirectly: () => boolean;
}

export type RunOnMainThread = <R, Fn extends (...args: any[]) => R>(fn: Fn) => (...args: Parameters<Fn>) => Promise<R>;

// Storage lives on the current `RootContext`; this binding is an alias kept in
// sync on writes and on context switches.
export let delayedRunOnMainThreadData: RunWorkletCtxData[] = getCurrentRootContext().delayedRunOnMainThreadData;

onRootContextSwitch(() => {
  delayedRunOnMainThreadData = getCurrentRootContext().delayedRunOnMainThreadData;
});

export function enqueueDelayedRunOnMainThreadData(data: RunWorkletCtxData): void {
  getCurrentRootContext().delayedRunOnMainThreadData.push(data);
}

export function takeDelayedRunOnMainThreadData(): RunWorkletCtxData[] {
  const ctx = getCurrentRootContext();
  const data = ctx.delayedRunOnMainThreadData;
  ctx.delayedRunOnMainThreadData = [];
  delayedRunOnMainThreadData = ctx.delayedRunOnMainThreadData;
  return data;
}

/**
 * @internal
 */
export function createRunOnMainThread(
  options: RunOnMainThreadOptions,
): RunOnMainThread {
  return <R, Fn extends (...args: any[]) => R>(fn: Fn): (...args: Parameters<Fn>) => Promise<R> => {
    if (__LEPUS__) {
      throw new Error('runOnMainThread can only be used on the background thread.');
    }
    if (!isMtsEnabled()) {
      throw new Error('runOnMainThread requires Lynx sdk version 2.14.');
    }
    return async (...params: Parameters<Fn>): Promise<R> => {
      return new Promise((resolve) => {
        const worklet = fn as unknown as Worklet;
        prepareMainThreadFunctionCtx(worklet);
        const data = {
          worklet,
          params,
          resolveId: onFunctionCall(resolve),
        } as RunWorkletCtxData;

        if (options.shouldDispatchRunOnMainThreadDirectly()) {
          dispatchRunOnMainThreadEvent(data);
          return;
        }

        enqueueDelayedRunOnMainThreadData(data);
      });
    };
  };
}

function isRunOnBackgroundSupported(): boolean {
  return isSdkVersionGt(2, 15);
}

function prepareMainThreadFunctionCtx(worklet: unknown): void {
  if (isMainThreadFunction(worklet) && isRunOnBackgroundSupported()) {
    registerBackgroundFunctionCtx(worklet);
  }
}

function dispatchRunOnMainThreadEvent(data: RunWorkletCtxData): void {
  getPageLynx().getCoreContext().dispatchEvent({
    type: WorkletEvents.runWorkletCtx,
    data: JSON.stringify(data),
  });
}
