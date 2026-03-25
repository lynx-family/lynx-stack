// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback, useState } from '@lynx-js/react';
import { demoImg as img } from './assets';
import './index.css';
function App() {
  const [enableScroll, setEnableScroll] = useState(true);
  const toggleScroll = useCallback(() => {
    setEnableScroll(!enableScroll);
  }, [setEnableScroll]);
  return (
    <view class='container'>
      <view class='button toggle-scroll' bindtap={toggleScroll}>
        <text>scr{enableScroll ? 'of' : 'on'}</text>
      </view>
      <scroll-view id='scrollNoXNoY' style='width:100%; height:500px;'>
        <view style='width: 100%; height: 100px; background-color: red;'></view>
        <image style='width:1000px; height:1000px;' src={img} />
      </scroll-view>

      <scroll-view id='scrollX' scroll-x enable-scroll={enableScroll}>
      </scroll-view>

      <scroll-view id='scrollY' scroll-y enable-scroll={enableScroll}>
      </scroll-view>

      <scroll-view
        id='scrollXFalse'
        scroll-x={false}
        enable-scroll={enableScroll}
      >
      </scroll-view>

      <scroll-view
        id='scrollYFalse'
        scroll-y={false}
        enable-scroll={enableScroll}
      >
      </scroll-view>

      <scroll-view id='scrollXY' scroll-x scroll-y enable-scroll={enableScroll}>
      </scroll-view>

      <scroll-view id='scrollXFalseY' scroll-x={false} scroll-y>
      </scroll-view>

      <scroll-view id='scrollXYFalse' scroll-x scroll-y={false}>
      </scroll-view>

      <scroll-view id='scrollXFalseYFalse' scroll-x={false} scroll-y={false}>
      </scroll-view>
    </view>
  );
}
root.render(<App></App>);
