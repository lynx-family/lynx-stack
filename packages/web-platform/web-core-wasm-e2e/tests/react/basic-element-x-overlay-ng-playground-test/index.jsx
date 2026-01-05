// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

import './index.css';

function App() {
  const [logs, setLogs] = useState([]);

  const [showModal1, setShowModal1] = useState(false);
  const toggleModal1 = () => {
    setLogs([...logs, 'toggle modal button 1 -------']);
    setShowModal1(!showModal1);
  };

  const [showModal2, setShowModal2] = useState(false);
  const toggleModal2 = () => {
    setLogs([...logs, 'toggle modal button 2 -------']);
    setShowModal2(!showModal2);
  };

  const [showModal3, setShowModal3] = useState(false);
  const toggleModal3 = () => {
    setLogs([...logs, 'toggle modal button 3 -------']);
    setShowModal3(!showModal3);
  };

  const [showModal4, setShowModal4] = useState(false);
  const toggleModal4 = () => {
    setLogs([...logs, 'toggle modal button 4 -------']);
    setShowModal4(!showModal4);
  };

  const onShowOverlay = (data) => {
    setLogs([...logs, 'on Show ----------']);
  };

  const onRequestClose = (data) => {
    setLogs([...logs, 'request close -----']);
  };

  const onDismissOverlay = (data) => {
    setLogs([...logs, 'on dismiss ---------']);
  };

  return (
    <scroll-view scroll-y class='test-card'>
      <text class='title'>测试页面</text>
      <text class='h1'>toast按钮</text>
      <view class='box'>
        <text class='desc'>
          Toast block应该居中, 点显示/关闭按钮能控制toast显示
        </text>
        <view class='button' catchtap={toggleModal1} id='toggleModal1'>
          {showModal1
            ? <text class='button-text'>关闭1</text>
            : <text class='button-text'>显示1</text>}
        </view>
        <view class='button' catchtap={toggleModal2} id='toggleModal2'>
          {showModal2
            ? <text class='button-text'>关闭2</text>
            : <text class='button-text'>显示2-内部元素每次都重新生成</text>}
        </view>
        <view class='button' catchtap={toggleModal3} id='toggleModal3'>
          {showModal3
            ? <text class='button-text'>关闭3</text>
            : <text class='button-text'>显示3</text>}
        </view>
        <view class='button' catchtap={toggleModal4} id='toggleModal4'>
          {showModal4
            ? <text class='button-text'>关闭4</text>
            : <text class='button-text'>显示4</text>}
        </view>
      </view>

      <text class='h1'>Logs</text>
      <view class='box'>
        {logs.map(item => <text class='word'>{item}</text>)}
      </view>

      <x-overlay-ng
        visible={showModal1}
        events-pass-through
        android-lazy-init-context={false}
        custom-layout
        status-bar-translucent-style='lite'
        status-bar-translucent
        bindshowoverlay={onShowOverlay}
        style={{ overflow: 'visible' }}
      >
        <view class='dialog-container'>
          <view class='dialog'>
            <text class='dialog-text'>Dialog 内部文字</text>
          </view>
        </view>
      </x-overlay-ng>

      // 如果需要内部元素每次都重新生成
      {showModal2
        ? (
          <x-overlay-ng
            overlay-id='overlay2'
            status-bar-translucent
            visible={showModal2}
            events-pass-through
            custom-layout
            cut-out-mode
            android-native-event-pass={false}
            class='dialog-overlay'
          >
            <view
              flatten={false}
              style='width: 100%; height: 100%; background-color:green'
            >
              <view
                style='width:100px;height:100px;position:absolute;bottom:0px;background-color:red'
                catchtap={toggleModal2}
              />
            </view>
          </x-overlay-ng>
        )
        : <view></view>}

      <x-overlay-ng
        overlay-id='overlay3'
        visible={showModal3}
        status-bar-translucent
        bindrequestclose={onRequestClose}
        bindshowoverlay={onShowOverlay}
        binddismissoverlay={onDismissOverlay}
        compat-bounding-rect
        events-pass-through
        always-show
        allow-pan-gesture
        custom-layout
        class='dialog-overlay'
      >
        <view
          id='overlay3-close-view'
          style='margin-top:400px;padding-top:30px'
          class='close-view'
          catchtap={toggleModal3}
        >
          <text id='overlay3-text-view'>close x-overlay</text>
        </view>
      </x-overlay-ng>

      <x-overlay-ng
        overlay-id='overlay4'
        visible={showModal4}
        status-bar-translucent
        custom-layout
        events-pass-through
        allow-pan-gesture={false}
        class='dialog-overlay'
      >
        <view style='width:100%;height:100%;'>
          <view
            style='width:100px;height:100px;background-color:gray'
            class='close-view3'
            catchtap={toggleModal4}
          >
            <text>close x-overlay</text>
          </view>
        </view>
      </x-overlay-ng>

      <text class='h1'>Ends</text>
    </scroll-view>
  );
}

root.render(<App></App>);
