// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';
import './index.css';

function App() {
  return (
    <view class='page'>
      <x-textarea
        class='textarea'
        placeholder='placeholder'
        placeholder-color='#DFA878'
        placeholder-font-size='20px'
      />
      <x-textarea
        class='textarea'
        placeholder='placeholder'
        placeholder-color='#DFA878'
      />
      {/* placeholder font-size 30px */}
      <x-textarea
        class='textarea textarea-font-size-30'
        placeholder='placeholder'
        placeholder-color='#DFA878'
      />
      {/* placeholder font-size 20px */}
      <x-textarea
        class='textarea textarea-font-size-30'
        placeholder='placeholder'
        placeholder-color='#DFA878'
        placeholder-font-size='20px'
      />
      {/* placeholder default font-size 14px */}
      <x-textarea
        class='textarea'
        placeholder='placeholder'
        placeholder-color='#DFA878'
      />
    </view>
  );
}

root.render(<App />);
