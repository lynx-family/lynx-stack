// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback } from '@lynx-js/react';
import './index.css';
function App() {
  const handleTap = useCallback(() => {
    lynx.createSelectorQuery()
      .select('#foldview')
      .invoke({
        method: 'setFoldExpanded',
        params: {
          offset: 99999,
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
        <x-foldview-slot-ng style='display:flex; width:90%; height:400px; flex-direction:column; background-color: salmon;'>
          <view style='background-color:orange;' bindtap={handleTap} id='tap'>
          </view>
        </x-foldview-slot-ng>
      </x-foldview-ng>
    </view>
  );
}
root.render(<App></App>);
