// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Transform-free main-thread scripting: functions are stringified at runtime
 * and evaluated once in the main-thread realm. They MUST be closure-free —
 * without a compiler there is no closure extraction; everything a main-thread
 * function needs must come through its arguments (e.g. the event object).
 */

import { enqueueOp } from './channel.js';
import * as Ops from './ops.js';

type AnyFunction = (...args: never[]) => unknown;

let nextWorkletId = 1;
const workletIds = new WeakMap<AnyFunction, number>();

/** Ships the function source to the main thread once per identity. */
export function registerWorklet(fn: AnyFunction): number {
  let id = workletIds.get(fn);
  if (id === undefined) {
    id = nextWorkletId++;
    workletIds.set(fn, id);
    enqueueOp([Ops.RegisterWorklet, id, fn.toString()]);
  }
  return id;
}

/**
 * Schedule a closure-free function to run on the main thread.
 *
 * @public
 */
export function runOnMainThread<Args extends unknown[], Ret>(
  fn: (...args: Args) => Ret,
): (...args: Args) => Promise<Ret> {
  // Background fallback: closure-capturing functions cannot cross threads
  // without a compiler, so the function runs here against op-backed APIs.
  return (...args) => Promise.resolve().then(() => fn(...args));
}

/** True main-thread execution for closure-free functions. */
export function runOnMainThreadStrict<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
): (...args: Args) => void {
  return (...args) => {
    enqueueOp([Ops.RunWorklet, registerWorklet(fn as AnyFunction), args]);
  };
}
