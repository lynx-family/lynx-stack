// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
/* global __BACKGROUND__ */

let __r = 0;
if (__BACKGROUND__) {
  for (let i = 0; i < 500; i++) {
    let base = i + 1;
    __r += base ** 2;
    __r += base ** 3;
    __r += 2 ** base;
    let x = base;
    x **= 2;
    __r += x;
  }
}

export const result = __r;
