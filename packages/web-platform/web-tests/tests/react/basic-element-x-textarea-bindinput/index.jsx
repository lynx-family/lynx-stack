// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root, useEffect } from '@lynx-js/react';
import './index.css';

function App() {
  const onInput = (e) => {
    if (typeof e.detail !== 'object') {
      throw new Error(
        `detail type not match. expect object, got ${typeof detail}`,
      );
    }
    console.log(e);
  };

  const onFocus = (e) => {
    console.log(e);
  };

  const onBlur = (e) => {
    console.log(e);
  };

  return (
    <view class='page'>
      <x-textarea
        class='textarea'
        data-testid='textarea'
        bindinput={onInput}
        bindblur={onBlur}
        bindfocus={onFocus}
      />
    </view>
  );
}

root.render(<App />);
