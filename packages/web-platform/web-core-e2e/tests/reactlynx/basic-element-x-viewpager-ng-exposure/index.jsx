// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import './index.css';
let realData = {
  viewpaper: '#ffffff',
  item1: '#ffffff',
  text1: '#ffffff',
  item2: '#ffffff',
  text2: '#ffffff',
};
function App() {
  const [data, setData] = useState(realData);
  const onExposure = useCallback((event) => {
    for (let e of event) {
      const index = e['exposure-id'];
      var new_obj = { ...realData };
      new_obj[index] = '#ff0000';
      realData = new_obj;
      setData(realData);
    }
  }, []);
  const onDisexposure = useCallback((event) => {
    for (let e of event) {
      const index = e['exposure-id'];
      var new_obj = { ...realData };
      new_obj[index] = '#00ff00';
      realData = new_obj;
      setData(realData);
    }
  }, []);
  useEffect(() => {
    lynx.getJSModule('GlobalEventEmitter').addListener(
      'exposure',
      onExposure,
      this,
    );
    lynx.getJSModule('GlobalEventEmitter').addListener(
      'disexposure',
      onDisexposure,
      this,
    );
  }, []);
  return (
    <view
      style='display: flex; flex-direction: column; width: 80%; height: 100%; left: 10%;'
      lynx-test-tag='container'
    >
      <text style={{ background: data.viewpaper }}>viewpager</text>
      <text style={{ background: data.item1 }}>Item1</text>
      <text style={{ background: data.text1 }}>Text1</text>
      <text style={{ background: data.item2 }}>Item2</text>
      <text style={{ background: data.text2 }}>Text2</text>
      <x-viewpager-ng
        exposure-scene='scene1'
        exposure-id='viewpaper'
        style='display: linear; width:100%; height:500px;border-width:1px;'
      >
        <x-viewpager-item-ng
          exposure-scene='scene1'
          exposure-id='item1'
          exposure-screen-margin-left='-10px'
          tag='tab1'
          style='width: 100%; height: 100%;'
        >
          <text
            exposure-scene='scene1'
            exposure-id='text1'
            exposure-screen-margin-left='-10px'
          >
            tab1
          </text>
        </x-viewpager-item-ng>
        <x-viewpager-item-ng
          exposure-scene='scene1'
          exposure-id='item2'
          exposure-screen-margin-right='-10px'
          tag='tab2'
          style='width: 100%; height: 100%;'
        >
          <text
            exposure-scene='scene1'
            exposure-id='text2'
            exposure-screen-margin-right='-10px'
          >
            tab2
          </text>
        </x-viewpager-item-ng>
      </x-viewpager-ng>
    </view>
  );
}
root.render(<App></App>);
