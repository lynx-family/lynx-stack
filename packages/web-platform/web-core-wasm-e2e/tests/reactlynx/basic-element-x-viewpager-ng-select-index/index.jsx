// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';
function App() {
  return (
    <view class='page'>
      <x-viewpager-ng class='viewpager-content' select-index={1}>
        <x-viewpager-item-ng class='viewpager-item' style='background:red;'>
        </x-viewpager-item-ng>
        <x-viewpager-item-ng class='viewpager-item' style='background:green;'>
        </x-viewpager-item-ng>
        <x-viewpager-item-ng class='viewpager-item' style='background:blue;'>
        </x-viewpager-item-ng>
        <x-viewpager-item-ng class='viewpager-item' style='background:yellow;'>
        </x-viewpager-item-ng>
      </x-viewpager-ng>
    </view>
  );
}
root.render(<App></App>);
