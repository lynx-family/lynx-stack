// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';
function App() {
  return (
    <view class='page'>
      <x-viewpager-ng
        class='viewpager-content'
        allow-horizontal-gesture={false}
      >
        <x-viewpager-item-ng class='viewpager-item'>
          <text>index-0</text>
        </x-viewpager-item-ng>
        <x-viewpager-item-ng class='viewpager-item'>
          <text>index-1</text>
        </x-viewpager-item-ng>
        <x-viewpager-item-ng class='viewpager-item'>
          <text>index-2</text>
        </x-viewpager-item-ng>
        <x-viewpager-item-ng class='viewpager-item'>
          <text>index-3</text>
        </x-viewpager-item-ng>
      </x-viewpager-ng>
    </view>
  );
}
root.render(<App></App>);
