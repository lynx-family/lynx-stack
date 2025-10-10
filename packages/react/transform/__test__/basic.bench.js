// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { bench, describe } from 'vitest';

import { transformReactLynx } from '../main.js';

describe('Basic', () => {
  const largeInputContent = `
import { useState } from "@lynx-js/react";

export function App() {
  return (
    <view>
      ${Array.from({ length: 1000 }, () => '<view/>').join('\n      ')}
    </view>
  );
}`;

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

  bench('transform 1000 view elements', async () => {
    await transformReactLynx(largeInputContent, config);
  });

  const largeInputContentWithEvent = `
export function App() {
  return (
    <view>
      ${Array.from({ length: 1000 }, () => '<view bindtap={() => void 0} />').join('\n      ')}
    </view>
  );
}`;

  bench.skip('transform 1000 view elements with event', async () => {
    await transformReactLynx(largeInputContentWithEvent, config);
  });

  const largeInputContentWithChildren = `
export function App() {
  return (
    <view>
      ${Array.from({ length: 1000 }, () => '<view>{content}</view>').join('\n      ')}
    </view>
  );
}`;

  bench.skip('transform 1000 view elements with Children', async () => {
    await transformReactLynx(largeInputContentWithChildren, config);
  });

  const largeInputContentWithEffect = `
import { useEffect } from '@lynx-js/react';

export function App() {
  ${Array.from({ length: 1000 }, () => 'useEffect(() => { console.log("effect") })').join('\n    ')}
  return (
    <view>
      <view />
    </view>
  );
}`;

  bench.skip('transform 1000 effects', async () => {
    await transformReactLynx(largeInputContentWithEffect, config);
  });
});
