// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
/* global __BACKGROUND__ */

async function compute(x) {
  return x + 1;
}

async function chain(n) {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += await compute(i);
  }
  return sum;
}

let __r = 0;
if (__BACKGROUND__) {
  const run = async () => {
    for (let i = 0; i < 50; i++) {
      __r += await chain(10);
    }
  };
  run();
}

export const result = __r;
