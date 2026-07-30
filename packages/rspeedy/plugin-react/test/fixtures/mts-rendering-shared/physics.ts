// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A stateful shared module: both worklets must observe the same live
// instance, so the counter accumulates across invocations of either.
let calls = 0

export function bump(step: number): number {
  calls += step
  return calls
}

export function total(): number {
  return calls
}

export const sharedMarker: string = 'shared-module-marker'
