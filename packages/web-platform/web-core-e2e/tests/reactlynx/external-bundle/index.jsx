// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
// `greeting-lib` is provided as an async external bundle (see
// external-bundle.config.ts). Using it at render time references it in both the
// main-thread and background layers, exercising lynx.fetchBundle + lynx.loadScript
// (and, for the main-thread layer, __LoadStyleSheet/__AdoptStyleSheet for its CSS).
import {
  getGreeting,
  getPublicPath,
  getWorkerEventTargetStatus,
} from 'greeting-lib';

function App() {
  const publicPath = getPublicPath();
  return (
    <view>
      <text id='target' className='external-greeting'>
        {getGreeting()}|{publicPath}
      </text>
      <text id='worker-event-target-status'>
        {getWorkerEventTargetStatus()}
      </text>
      <text
        id='main-thread-public-path'
        main-thread:bindtap={(event) => {
          'main thread';
          event.currentTarget.setAttribute('data-public-path', publicPath);
        }}
      >
        reveal main-thread public path
      </text>
    </view>
  );
}

root.render(<App></App>);
