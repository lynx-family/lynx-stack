// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';
import './index.css';

function App() {
  const [placeholderColor, setPlaceholderColor] = useState('#D71313');
  const [placeholderFontSize, setPlaceholderFontSize] = useState('12px');
  const [placeholderFontWeight, setPlaceholderFontWeight] = useState('bold');

  const switchPlaceholderStyle = () => {
    setPlaceholderColor('#F0DE36');
    setPlaceholderFontSize('16px');
    setPlaceholderFontWeight('normal');
  };

  return (
    <view class='page'>
      <view class='block' bindtap={switchPlaceholderStyle}></view>
      <x-textarea
        class='textarea'
        placeholder='placeholder'
        placeholder-color='#DFA878'
        placeholder-font-size='20px'
        placeholder-font-weight='normal'
      />
      <x-textarea
        class='textarea'
        placeholder='placeholder'
        placeholder-color={placeholderColor}
        placeholder-font-size={placeholderFontSize}
        placeholder-font-weight={placeholderFontWeight}
      />
    </view>
  );
}

root.render(<App />);
