// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  const value = 'bindselection';
  const [result, setResult] = useState();

  const onSelection = ({ detail: { selectionStart, selectionEnd } }) => {
    setResult(`${selectionStart}-${selectionEnd}`);
  };

  return (
    <view>
      <x-textarea
        bindselection={onSelection}
        value={value}
        style='border: 1px solid;width: 80vw;height:40px'
      />
      <view class='result'>
        <text>{result}</text>
      </view>
    </view>
  );
}

root.render(<App></App>);
