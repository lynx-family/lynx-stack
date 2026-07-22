// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { onFunctionCall } from './return-value.js';
import { registerContextSlot } from '../../root-context.js';
import { isSdkVersionGt } from '../../utils.js';
import { WorkletEvents } from '../../worklet-runtime/bindings/events.js';
import type { RunWorkletCtxData } from '../../worklet-runtime/bindings/events.js';
import type { Worklet } from '../../worklet-runtime/bindings/types.js';
import { registerBackgroundFunctionCtx } from '../background-function/run-on-background.js';

interface RunOnMainThreadOptions {
  shouldDispatchRunOnMainThreadDirectly: () => boolean;
}

export type RunOnMainThread = <R, Fn extends (...args: any[]) => R>(fn: Fn) => (...args: Parameters<Fn>) => Promise<R>;

export let delayedRunOnMainThreadData: RunWorkletCtxData[] = [];

if (typeof __MULTI_PAGE__ !== 'undefined' && __MULTI_PAGE__) {
  registerContextSlot({
    id: 'delayedRunOnMainThreadData',
    init: () => [],
    save(bag) {
      bag['delayedRunOnMainThreadData'] = delayedRunOnMainThreadData;
    },
    load(bag) {
      delayedRunOnMainThreadData = bag['delayedRunOnMainThreadData'] as RunWorkletCtxData[];
    },
  });
}

export function enqueueDelayedRunOnMainThreadData(data: RunWorkletCtxData): void {
  delayedRunOnMainThreadData.push(data);
}

export function takeDelayedRunOnMainThreadData(): typeof delayedRunOnMainThreadData {
  const data = delayedRunOnMainThreadData;
  delayedRunOnMainThreadData = [];
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
    if (!isMainThreadFunctionSupported()) {
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

function isMainThreadFunctionSupported(): boolean {
  return isSdkVersionGt(2, 13);
}

function isRunOnBackgroundSupported(): boolean {
  return isSdkVersionGt(2, 15);
}

function isMainThreadFunctionCtx(value: unknown): value is Worklet {
  return value != null
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof (value as { _wkltId?: unknown })._wkltId === 'string';
}

function prepareMainThreadFunctionCtx(worklet: unknown): void {
  if (isMainThreadFunctionCtx(worklet) && isRunOnBackgroundSupported()) {
    registerBackgroundFunctionCtx(worklet);
  }
}

function dispatchRunOnMainThreadEvent(data: RunWorkletCtxData): void {
  lynx.getCoreContext().dispatchEvent({
    type: WorkletEvents.runWorkletCtx,
    data: JSON.stringify(data),
  });
}
