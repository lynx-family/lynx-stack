// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { noop } from './noop.js';

const registeredCallableMap = new Map<string, CallableFunction>(); // Regular Map for primitive keys

export function registerCallable(func: CallableFunction, id: string): string {
  registeredCallableMap.set(id, func);

  return id;
}

export function runOnRegistered<T extends CallableFunction = CallableFunction>(
  id: string,
): T {
  const func = registeredCallableMap.get(id) ?? noop;
  return func as unknown as T;
}

declare global {
  // biome-ignore lint/suspicious/noRedeclare: <explanation>
  var runOnRegistered: <T extends CallableFunction = CallableFunction>(
    id: string,
  ) => T;
}

// We use globalThis trick to get over with closure capture
// @TODO: Remove this when ReactLynx supports importing MTS for module
globalThis.runOnRegistered = runOnRegistered;
