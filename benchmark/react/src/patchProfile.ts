// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hook } from './hook.js';

if (__BACKGROUND__) {
  // eslint-disable-next-line no-global-assign
  console = { ...console };
}

const stack: string[] = [];

hook(console, 'profile', (old, name) => {
  old!(name);
  stack.push(name!);
  Codspeed.startBenchmark();
});

hook(console, 'profileEnd', (old) => {
  Codspeed.stopBenchmark();
  const name = stack.pop();
  Codspeed.setExecutedBenchmark(
    `${__webpack_public_path__}::${__webpack_chunkname__}-${name!}`,
  );
  old!();
});
