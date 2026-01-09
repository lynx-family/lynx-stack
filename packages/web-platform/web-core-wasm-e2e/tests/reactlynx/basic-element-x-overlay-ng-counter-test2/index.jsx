// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

import './index.css';

function Template({ len, color, cnt, onTap, show }) {
  return (
    <x-overlay-ng
      events-pass-through
      visible={show}
      style="height: {{__globalProps.screenHeight?__globalProps.screenHeight + 'px': '100%'}}; width: {{__globalProps.screenWidth?__globalProps.screenWidth + 'px': '100%'}};"
      status-bar-translucent
      class='dialog-overlay3'
    >
      <view class='container'>
        <view
          class='block'
          style={`width:${len}px;height:${len}px;border-color:${color};background-color:white;`}
          event-through={false}
          data-cnt={cnt}
          bindtap={onTap}
        >
          <text>
            <x-text>{`点击该方块，使计数 + ${cnt}`}</x-text>
          </text>
        </view>
      </view>
    </x-overlay-ng>
  );
}

function App() {
  const [show, setShow] = useState(false);
  const [showModal, setShowModal] = useState([false, false, false, false]);
  const [txt, setTxt] = useState('');
  const [focus1, setFocus1] = useState(false);
  const [focus2, setFocus2] = useState(false);
  const [logs, setLogs] = useState([]);
  const [cnt, setCnt] = useState(0);

  const toggleModal = (e) => {
    setShow(!show);
    showModal[e.currentTarget.dataset.index] =
      !showModal[e.currentTarget.dataset.index];
    setShowModal(showModal);
    setTxt(e.currentTarget.dataset.text);
  };

  const onTap = (e) => {
    setCnt(cnt + e.currentTarget.dataset.cnt);
  };

  const onClose = () => {
    setShowModal([false, false, false, false]);
    setShow(false);
  };

  return (
    <view>
      <scroll-view scroll-y class='test-card'>
        <text class='h1'>toast按钮</text>
        <view class='box'>
          <text class='desc'>
            {`点显示/关闭按钮能控制toast显示。显示之后点击对应方块，观察行为是否符合预期，目前计数为 ${cnt}`}
          </text>
          <view class='button' catchtap={onClose}>
            <text class='button-text'>关闭所有 toast</text>
          </view>
          <view class='button' catchtap={toggleModal} data-index={0}>
            {showModal[0]
              ? <text class='button-text'>关闭红色边框方块</text>
              : <text class='button-text'>显示红色边框方块</text>}
          </view>
          <view class='button' catchtap={toggleModal} data-index={1}>
            {showModal[1]
              ? <text class='button-text'>关闭蓝色边框方块</text>
              : <text class='button-text'>显示蓝色边框方块</text>}
          </view>
          <view class='button' catchtap={toggleModal} data-index={2}>
            {showModal[2]
              ? <text class='button-text'>关闭绿色边框方块</text>
              : <text class='button-text'>显示绿色边框方块</text>}
          </view>
          <view class='button' catchtap={toggleModal} data-index={3}>
            {showModal[3]
              ? <text class='button-text'>关闭黑色边框方块</text>
              : <text class='button-text'>显示黑色边框方块</text>}
          </view>
        </view>

        <Template
          show={showModal[0]}
          len={250}
          color='red'
          cnt={1}
          onTap={onTap}
        />
        <Template
          show={showModal[1]}
          len={200}
          color='blue'
          cnt={2}
          onTap={onTap}
        />
        <Template
          show={showModal[2]}
          len={150}
          color='green'
          cnt={3}
          onTap={onTap}
        />
        <Template
          show={showModal[3]}
          len={100}
          color='black'
          cnt={4}
          onTap={onTap}
        />
        <text class='h1'>Ends</text>
      </scroll-view>
    </view>
  );
}

root.render(<App></App>);
