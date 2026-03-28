// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { log } from '../common.js';

export function div(a, b) {
  log(`div(${a}, ${b})`);
  return a / b;
}
