// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback, useRef } from '@lynx-js/react';
import './index.css';

const tabs = [0, 1, 2, 3, 4, 5];
function App() {
  const ref = useRef();
  const onChange = useCallback((e) => {
    console.log(e);
  }, []);

  const handleTabClick = (idx) => {
    ref.current
      .invoke({
        method: 'selectTab',
        params: {
          index: idx,
          smooth: true,
        },
        success: function(res) {},
        fail: function(res) {},
      })
      .exec();
  };

  return (
    <view class='page'>
      <view class='controls'>
        <text data-testid='first' bindtap={() => handleTabClick(0)}>
          select first tab
        </text>
        <text
          data-testid='last'
          bindtap={() => handleTabClick(tabs.length - 1)}
        >
          select last tab
        </text>
      </view>
      <x-viewpager-ng
        class='viewpager-content'
        bindchange={onChange}
        data-testid='bindchange'
        ref={ref}
      >
        {tabs.map(i => (
          <x-viewpager-item-ng class='viewpager-item'>
            <text>index-{i}</text>
          </x-viewpager-item-ng>
        ))}
      </x-viewpager-ng>
    </view>
  );
}
root.render(<App></App>);
