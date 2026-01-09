// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback } from '@lynx-js/react';
import './index.css';
let count = 0;
function App() {
  const handleTap = useCallback(() => {
    lynx.createSelectorQuery()
      .select('#foldview')
      .invoke({
        method: 'setFoldExpanded',
        params: {
          offset: 100,
          smooth: false,
        },
      })
      .exec();
  }, []);
  return (
    <view style='width: 100%; height:600px; display:flex; flex-direction: column;'>
      <x-foldview-ng
        id='foldview'
        style='width:80%; height:600px; background-color: wheat;display:flex; flex-direction: column;'
      >
        <x-foldview-toolbar-ng style='display:flex; width:70%; background-color: cadetblue;'>
          <view style='height:200px;width:100%;'>
          </view>
        </x-foldview-toolbar-ng>
        <x-foldview-header-ng style='position:absolute; width:80%; height:400px; background-color: pink;'>
          <view style='background-color:aqua; width:95%;'></view>
        </x-foldview-header-ng>
        <x-foldview-slot-ng style='display:flex; width:90%; height:300px; flex-direction:column; background-color: salmon;'>
          <scroll-view style='width:80%; height:300px;' scroll-y>
            <view style='background-color:orange;' bindtap={handleTap} id='tap'>
            </view>
            <view style='background-color:tomato;'></view>
            <view style='background-color:thistle;'></view>
            <view style='background-color:forestgreen;'></view>
            <view style='background-color:firebrick;'></view>
            <view style='background-color:silver;'></view>
            <view style='background-color:seashell;'></view>
          </scroll-view>
        </x-foldview-slot-ng>
      </x-foldview-ng>
    </view>
  );
}
root.render(<App></App>);
