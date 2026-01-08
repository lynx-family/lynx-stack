// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <view style='display:flex;'>
      <text text-selection='true' flatten='false'>
        text-selection-true-boolean-flatten-false
      </text>
      <text text-selection='true' flatten='false'>
        text-selection-true-string-flatten-false
      </text>
      <text text-selection='false' flatten='false'>
        text-selection-false-string-flatten-false
      </text>
      <text text-selection='false' flatten='false'>
        text-selection-false-boolean-flatten-false
      </text>
    </view>
  );
}
root.render(<App></App>);
