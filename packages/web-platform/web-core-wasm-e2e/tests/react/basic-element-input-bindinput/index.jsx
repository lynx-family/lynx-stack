// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  const value = 'bindinput';
  const [result, setResult] = useState();

  const onInput = ({ detail }) => {
    if (typeof detail !== 'object') {
      throw new Error(
        `detail type not match. expect object, got ${typeof detail}`,
      );
    }

    const { value, cursor, textLength, selectionStart, selectionEnd } = detail;

    if (value.length !== textLength) {
      throw new Error(
        `input length not match. expect ${textLength}, got ${value.length}`,
      );
    }

    setResult(`${value}-${selectionStart}-${selectionStart}`);
  };

  return (
    <view>
      <input
        bindinput={onInput}
        value={value}
        style='border: 1px solid;width: 300px;height:40px'
      />
      <view class='result'>
        <text>{result}</text>
      </view>
    </view>
  );
}

root.render(<App></App>);
