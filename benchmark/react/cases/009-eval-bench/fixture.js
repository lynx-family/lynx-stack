// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
/* global __BACKGROUND__ */

let __counter = 0;
function fence(x) {
  __counter += 1;
  return x;
}

let __r = 0;
if (__BACKGROUND__) {
  for (let i = 0; i < 500; i++) {
    let v0 = fence(i);
    const v1 = fence(v0 + 1);
    const v2 = fence(v1 + 2);
    let v3 = fence(v2 + 3);
    const v4 = fence(v3 + 4);
    const v5 = fence(v4 + 5);
    __r += v5;
  }
}

export const result = __r;
export const counter = __counter;
