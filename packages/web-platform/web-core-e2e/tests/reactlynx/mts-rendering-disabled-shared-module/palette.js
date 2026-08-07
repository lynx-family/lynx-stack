// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A stateful shared module. Both worklets below must reach the same live
// instance on the main thread, so the step accumulates across them.
const colors = ['pink', 'green', 'blue'];

let index = 0;

export function next() {
  index = (index + 1) % colors.length;
  return colors[index];
}

export function current() {
  return colors[index];
}
