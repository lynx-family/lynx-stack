// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { noop } from './noop.js';
const registeredCallableMap = new Map(); // Regular Map for primitive keys
export function registerCallable(func, id) {
    registeredCallableMap.set(id, func);
    return id;
}
export function runOnRegistered(id) {
    const func = registeredCallableMap.get(id) ?? noop;
    return func;
}
// We use globalThis trick to get over with closure capture
// @TODO: Remove this when ReactLynx supports importing MTS for module
globalThis.runOnRegistered = runOnRegistered;
//# sourceMappingURL=registeredFunction.js.map