// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';
function App() {
  return (
    <view style='width: 100%; height:600px; display:flex; flex-direction: column;'>
      <x-foldview-ng
        id='foldview'
        style='width:300px; height:600px; background-color: wheat;display:flex; flex-direction: column;'
      >
        <x-foldview-toolbar-ng style='display:flex; width:100%; background-color: cadetblue;'>
          <view style='height:200px;width:100%;'>
          </view>
        </x-foldview-toolbar-ng>
        <x-foldview-header-ng
          id='header'
          style='height:400px; background-color: pink;'
        >
          <view style='background-color:aqua; width:100px;'></view>
        </x-foldview-header-ng>
        <x-foldview-slot-ng style='display:flex; width:100%; height:300px; flex-direction:column; background-color: salmon;'>
          <view style='background-color:orange;'></view>
        </x-foldview-slot-ng>
      </x-foldview-ng>
    </view>
  );
}
root.render(<App></App>);
