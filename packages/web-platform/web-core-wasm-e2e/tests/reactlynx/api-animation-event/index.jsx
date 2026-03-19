// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useRef, useState } from '@lynx-js/react';
import './index.css';
function App() {
  const dataRef = useRef({
    visible1: false,
    visible2: false,
    ani1: false,
    ani2: false,
    transitionEventNames: '',
    animationEventNames: '',
  });
  const [, setData] = useState();
  const handleAni = (event) => {
    const { type } = event;
    if (type.match(/^animation/)) {
      dataRef.current = {
        ...dataRef.current,
        animationEventNames: `${dataRef.current.animationEventNames} ${type}`,
      };
      setData(dataRef.current);
    } else if (event.params['animation_name'] === 'background-color') {
      dataRef.current = {
        ...dataRef.current,
        transitionEventNames: `${dataRef.current.transitionEventNames} ${type}`,
      };
      setData(dataRef.current);
    }
  };
  const handleTap1 = () => {
    dataRef.current = {
      ...dataRef.current,
      visible1: !dataRef.current.visible1,
    };
    setData(dataRef.current);
  };

  const handleTap2 = () => {
    dataRef.current = {
      ...dataRef.current,
      visible2: !dataRef.current.visible2,
    };
    setData(dataRef.current);
  };

  const handleTap3 = () => {
    dataRef.current = {
      ...dataRef.current,
      ani1: !dataRef.current.ani1,
    };
    setData(dataRef.current);
  };

  const handleTap4 = () => {
    dataRef.current = {
      ...dataRef.current,
      ani2: !dataRef.current.ani2,
    };
    setData(dataRef.current);
  };
  const {
    visible1,
    ani1,
    visible2,
    ani2,
    transitionEventNames,
    animationEventNames,
  } = dataRef.current;
  return (
    <>
      <view class='intro'>
        <text>view animator test</text>
        <view
          id='blue0'
          class={`test-box ${visible1 ? ' haha' : ''} ${
            ani1 ? ' showDescAnimation' : ' hideDescAnimation'
          }`}
          bindtransitionend={handleAni}
          bindtransitionstart={handleAni}
          bindtransitioncancel={handleAni}
          bindanimationstart={handleAni}
          bindanimationcancel={handleAni}
          bindanimationend={handleAni}
          bindanimationiteration={handleAni}
        >
          <text>test box1</text>
        </view>
        <view id='tap1' bindtap={handleTap1}>
          <text>toggle transition 1</text>
        </view>
        <view id='tap3' bindtap={handleTap3}>
          <text>toggle animation 1</text>
        </view>
      </view>
      <view class='intro'>
        <text>text animator test</text>
        <view class='test-box'>
          <text
            id='blue1'
            class={`test-box ${visible2 ? 'haha' : ''} ${
              ani2 ? ' showDescAnimation' : ' hideDescAnimation'
            }`}
            bindtransitionend={handleAni}
            bindtransitionstart={handleAni}
            bindtransitioncancel={handleAni}
            bindanimationstart={handleAni}
            bindanimationcancel={handleAni}
            bindanimationend={handleAni}
            bindanimationiteration={handleAni}
          >
            test box2
          </text>
        </view>
        <view id='tap2' bindtap={handleTap2}>
          <text>toggle transition 2</text>
        </view>
        <view id='tap4' bindtap={handleTap4}>
          <text>toggle animation 2</text>
        </view>
      </view>
      <view>
        <text>transitionEventNames: {transitionEventNames}</text>
      </view>
      <view>
        <text>animationEventNames: {animationEventNames}</text>
      </view>
    </>
  );
}

root.render(<App></App>);
