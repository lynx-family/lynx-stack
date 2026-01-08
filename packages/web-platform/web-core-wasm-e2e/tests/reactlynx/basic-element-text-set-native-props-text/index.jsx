// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './index.css';
import { root, useCallback, useEffect, useState } from '@lynx-js/react';
let count = 0;
function App() {
  const [test, setTest] = useState('');

  const setTimeData = useCallback((_type, time) => {
    lynx.createSelectorQuery()
      .select(`.countdown__num--${_type}`)
      .setNativeProps({ text: time })
      .exec();
  }, []);
  useEffect(() => {
    setTimeout(() => {
      setTimeData('h', 'the count is:' + ++count);
    }, 100);
  }, [setTest]);
  return (
    <view class='countdown'>
      <view class='countdown__block'>
        <text class='countdown__num countdown__num--h'>
          --<text>hello</text>--<text>world</text>
        </text>
      </view>
    </view>
  );
}
root.render(<App></App>);
