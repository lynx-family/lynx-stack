// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
// `greeting-lib` is provided as an async external bundle (see
// external-bundle.config.ts). Using it at render time references it in both the
// main-thread and background layers, exercising lynx.fetchBundle + lynx.loadScript
// (and, for the main-thread layer, __LoadStyleSheet/__AdoptStyleSheet for its CSS).
import { getGreeting } from 'greeting-lib';

function App() {
  return <text id='target' className='external-greeting'>{getGreeting()}</text>;
}

root.render(<App></App>);
