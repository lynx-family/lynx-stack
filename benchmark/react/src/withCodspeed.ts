// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Bench } from 'tinybench';

import { hook } from './hook.js';

function withCodspeed(bench: Bench) {
  hook(bench, 'add', function(this: Bench, old, name, fn, fnOpts) {
    return old!.call(this, name, () => {
      Codspeed.startBenchmark();
      fn();
      Codspeed.stopBenchmark();
      Codspeed.setExecutedBenchmark(name);
    }, fnOpts);
  });

  return bench;
}

export { withCodspeed };
