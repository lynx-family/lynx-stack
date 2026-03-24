// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback } from '@lynx-js/react';
import './index.css';
function App() {
  const onChange = useCallback((e) => {
    console.log({ index: e.detail.index, isDragged: e.detail.isDragged });
  }, []);
  return (
    <view class='page'>
      <x-viewpager-ng
        class='viewpager-content'
        bindchange={onChange}
        data-testid='bindchange'
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
