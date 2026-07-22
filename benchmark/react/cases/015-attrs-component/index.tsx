// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root } from '@lynx-js/react';

import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

const ELEMENT_COUNT = 100;

interface TextProps {
  enableFontScaling: boolean;
  includeFontPadding: boolean;
  tailColorConvert: boolean;
  textFakeBold: boolean;
  textMaxlength: string;
  textMaxline: string;
  textSelection: boolean;
  textVerticalAlign: string;
}

function Text(props: TextProps) {
  return (
    <text
      text-maxline={props.textMaxline}
      text-maxlength={props.textMaxlength}
      enable-font-scaling={props.enableFontScaling}
      text-vertical-align={props.textVerticalAlign}
      tail-color-convert={props.tailColorConvert}
      include-font-padding={props.includeFontPadding}
      text-fake-bold={props.textFakeBold}
      text-selection={props.textSelection}
    />
  );
}

function App() {
  return (
    <view>
      {Array.from({ length: ELEMENT_COUNT }, () => (
        <Text
          textMaxline='2'
          textMaxlength='128'
          enableFontScaling={false}
          textVerticalAlign='center'
          tailColorConvert={false}
          includeFontPadding={false}
          textFakeBold={false}
          textSelection={false}
        />
      ))}
    </view>
  );
}

runAfterLoadScript(() => {
  root.render(
    <>
      <App />
      <RunBenchmarkUntilHydrate />
    </>,
  );
});
