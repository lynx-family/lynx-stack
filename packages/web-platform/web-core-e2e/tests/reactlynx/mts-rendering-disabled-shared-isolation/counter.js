// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The docs specify that a shared module is instantiated once per thread, with
// state isolated between them. The background bumps this counter on mount; the
// main thread must not observe those bumps.
let count = 0;

export function bump() {
  count += 1;
  return count;
}
