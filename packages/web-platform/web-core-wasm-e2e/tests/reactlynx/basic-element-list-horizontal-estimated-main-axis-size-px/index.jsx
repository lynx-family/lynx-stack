// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect, useRef } from '@lynx-js/react';
import './index.css';

function App() {
  const ref = useRef(null);

  const handleScrollToLower = (e) => {
    console.log(e);
  };

  useEffect(() => {
    ref.current
      ?.invoke({
        method: 'autoScroll',
        params: {
          rate: '100',
          start: true,
        },
      })
      .exec();
  }, []);

  return (
    <view class='page'>
      <list
        list-type='single'
        scroll-orientation='horizontal'
        bindscrolltolower={handleScrollToLower}
        ref={ref}
      >
        <list-item item-key='1' id='1' estimated-main-axis-size-px={100}>
          <text>1</text>
        </list-item>
        <list-item item-key='2' id='2' estimated-main-axis-size-px={100}>
          <text>2</text>
        </list-item>
        <list-item item-key='3' id='3' estimated-main-axis-size-px={100}>
          <text>3</text>
        </list-item>
        <list-item item-key='4' id='4' estimated-main-axis-size-px={100}>
          <text>4</text>
        </list-item>
        <list-item item-key='5' id='5' estimated-main-axis-size-px={100}>
          <text>5</text>
        </list-item>
        <list-item item-key='6' id='6' estimated-main-axis-size-px={100}>
          <text>6</text>
        </list-item>
      </list>
    </view>
  );
}

root.render(<App></App>);
