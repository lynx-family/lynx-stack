// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';

function App() {
  const handleScroll = (e) => {
    console.log(e);
  };
  const handleScrollEnd = (e) => {
    console.log(e);
  };

  return (
    <view class='page'>
      <list
        list-type='single'
        bindscroll={handleScroll}
        bindscrollend={handleScrollEnd}
      >
        <list-item id='1'>
          <view class='item' style={{ '--item-index': 1 }}></view>
        </list-item>
        <list-item id='2'>
          <view class='item' style={{ '--item-index': 2 }}></view>
        </list-item>
        <list-item id='3'>
          <view class='item' style={{ '--item-index': 3 }}></view>
        </list-item>
        <list-item id='4'>
          <view class='item' style={{ '--item-index': 4 }}></view>
        </list-item>
        <list-item id='5'>
          <view class='item' style={{ '--item-index': 5 }}></view>
        </list-item>
        <list-item id='6'>
          <view class='item' style={{ '--item-index': 6 }}></view>
        </list-item>
        <list-item id='7'>
          <view class='item' style={{ '--item-index': 7 }}></view>
        </list-item>
        <list-item id='8'>
          <view class='item' style={{ '--item-index': 8 }}></view>
        </list-item>
        <list-item id='9'>
          <view class='item' style={{ '--item-index': 9 }}></view>
        </list-item>
        <list-item id='10'>
          <view class='item' style={{ '--item-index': 10 }}></view>
        </list-item>
      </list>
    </view>
  );
}

root.render(<App></App>);
