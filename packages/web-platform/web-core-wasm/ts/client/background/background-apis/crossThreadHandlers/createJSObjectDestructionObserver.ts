// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NativeApp } from '../../../../types/index.js';

export function createJSObjectDestructionObserver(): NativeApp[
  'createJSObjectDestructionObserver'
] {
  const registry = new FinalizationRegistry((
    callback: (...args: unknown[]) => unknown,
  ) => callback());
  return (cleanupCallback) => {
    const observedObject = {};
    registry.register(observedObject, cleanupCallback);
    return observedObject;
  };
}
