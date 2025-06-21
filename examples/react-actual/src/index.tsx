import { setRootComponent } from '@lynx-js/react-actual';
import React, { useState, useEffect } from 'react';
// import type { MainThread } from '@lynx-js/types';
import './index.css';

function Counter() {
  const [count, setCount] = useState(1);
  const increment = (_e) => {
    setCount(count + 1);
  };

  // useEffect(() => {
  //   setCount(count + 1);
  // })

  return (
    <view class='container'>
      <image
        main-thread:bindtap={increment}
        class='logo'
        src='https://github.com/lynx-family.png'
      >
      </image>
      <text class='slogan'>Lynx: Unlock Native for More</text>
      <text>{count}</text>
    </view>
  );
}

setRootComponent(React.createElement(Counter));
