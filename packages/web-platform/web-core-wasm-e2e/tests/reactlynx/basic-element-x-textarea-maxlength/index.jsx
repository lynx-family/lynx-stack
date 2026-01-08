// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';
import './index.css';

function App() {
  const [value, setVal] = useState('');
  const [maxLength, setMaxLength] = useState(140);
  const [value_1, setValue_1] = useState('');
  const [maxLength_1, setMaxLength_1] = useState(140);
  const [value_2, setValue_2] = useState('');
  const [maxLength_2, setMaxLength_2] = useState(140);
  const [value_3, setValue_3] = useState('');
  const [maxLength_3, setMaxLength_3] = useState(140);
  const [value_4, setValue_4] = useState('');
  const [maxLength_4, setMaxLength_4] = useState(140);

  const setValue = () => {
    setVal('OO');
  };

  const setLength = () => {
    setMaxLength(2);
  };

  const setValueLength = () => {
    setValue_1('OO');
    setMaxLength_1(2);
  };

  const setLengthValue = () => {
    setValue_2('OO');
    setMaxLength_2(2);
  };

  const setLengthAndValue = () => {
    setValue_3('OO');
    setMaxLength_3(2);
  };

  const setValueAndLength = () => {
    setValue_4('OO');
    setMaxLength_4(2);
  };

  return (
    <scroll-view class='page'>
      <view class='block' data-testid='setValue' bindtap={setValue}></view>
      <view class='block' data-testid='setLength' bindtap={setLength}></view>
      <view class='block' data-testid='setValueLength' bindtap={setValueLength}>
      </view>
      <view class='block' data-testid='setLengthValue' bindtap={setLengthValue}>
      </view>
      <view
        class='block'
        data-testid='setLengthAndValue'
        bindtap={setLengthAndValue}
      >
      </view>
      <view
        class='block'
        data-testid='setValueAndLength'
        bindtap={setValueAndLength}
      >
      </view>
      <x-textarea class='textarea' maxlength={1} value='OO' />
      <x-textarea
        class='textarea'
        id='dynamic-value'
        maxlength={2}
        value={value}
      />
      <x-textarea
        class='textarea'
        id='dynamic-length'
        value='OO'
        maxlength={maxLength}
      />
      <x-textarea
        class='textarea'
        id='dynamic-value-length'
        value={value_1}
        maxlength={maxLength_1}
      />
      <x-textarea
        class='textarea'
        id='dynamic-length-value'
        value={value_2}
        maxlength={maxLength_2}
      />
      <x-textarea
        class='textarea'
        id='dynamic-length-and-value'
        value={value_3}
        maxlength={maxLength_3}
      />
      <x-textarea
        class='textarea'
        id='dynamic-value-and-length'
        value={value_4}
        maxlength={maxLength_4}
      />
      <x-textarea class='textarea' maxlength={2} value='OO' />
      <x-textarea class='textarea' maxlength={3} value='OO' />
      <x-textarea class='textarea' maxlength={4} value='OO' />
      <x-textarea class='textarea' maxlength={5} value='OO' />
    </scroll-view>
  );
}

root.render(<App />);
