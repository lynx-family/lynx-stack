// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { withCodSpeed } from '@codspeed/tinybench-plugin';
import { Bench } from 'tinybench';

import { transformReactLynx } from '../main.js';

const config = {
  pluginName: '',
  filename: '',
  sourcemap: false,
  cssScope: false,
  jsx: true,
  directiveDCE: false,
  defineDCE: false,
  shake: true,
  compat: false,
  worklet: false,
  refresh: false,
};

function repeat(line, count = 1000) {
  return Array.from({ length: count }, () => line).join('\n      ');
}

// `skip: true` entries are kept disabled, as they were under `bench.skip`.
const cases = [
  {
    name: 'transform 1000 view elements',
    skip: false,
    source: `
import { useState } from "@lynx-js/react";

export function App() {
  return (
    <view>
      ${repeat('<view/>')}
    </view>
  );
}`,
  },
  {
    name: 'transform 1000 view elements with event',
    skip: true,
    source: `
export function App() {
  return (
    <view>
      ${repeat('<view bindtap={() => void 0} />')}
    </view>
  );
}`,
  },
  {
    name: 'transform 1000 view elements with Children',
    skip: true,
    source: `
export function App() {
  return (
    <view>
      ${repeat('<view>{content}</view>')}
    </view>
  );
}`,
  },
  {
    name: 'transform 1000 effects',
    skip: true,
    source: `
import { useEffect } from '@lynx-js/react';

export function App() {
  ${repeat('useEffect(() => { console.log("effect") })')}
  return (
    <view>
      <view />
    </view>
  );
}`,
  },
];

const bench = withCodSpeed(new Bench({ name: 'Basic' }));

for (const { name, skip, source } of cases) {
  if (skip) {
    continue;
  }
  bench.add(name, async () => {
    await transformReactLynx(source, config);
  });
}

await bench.run();
console.table(bench.table());
