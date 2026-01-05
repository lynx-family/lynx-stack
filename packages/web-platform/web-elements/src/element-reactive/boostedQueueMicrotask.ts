/**
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
let queuedFunctions: [any, any][] = [];
function __executeNextMicrotask() {
  const currentQueuedFunction = queuedFunctions;
  queuedFunctions = [];
  for (const [foo, that] of currentQueuedFunction) {
    that ? foo.call(that) : foo();
  }
}
export function boostedQueueMicrotask(foo: CallableFunction, that?: any) {
  if (queuedFunctions.length === 0) {
    queueMicrotask(__executeNextMicrotask);
  }
  queuedFunctions.push([foo, that]);
}
