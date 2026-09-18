// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  const [textResult, setTextResult] = useState('');
  const [inlineTextResult, setInlineTextResult] = useState('');
  const formatSelection = ({ detail: { start, end, direction } }) =>
    `${start}-${end}-${direction}`;

  return (
    <view>
      <text
        id='target'
        text-selection={true}
        flatten={false}
        bindselectionchange={(event) => setTextResult(formatSelection(event))}
      >
        {'before'}
        <inline-text
          id='inline-target'
          bindselectionchange={(event) =>
            setInlineTextResult(formatSelection(event))}
        >
          {'inline'}
        </inline-text>
        {'after'}
      </text>
      <text class='text-result'>{textResult}</text>
      <text class='inline-text-result'>{inlineTextResult}</text>
    </view>
  );
}

root.render(<App />);
