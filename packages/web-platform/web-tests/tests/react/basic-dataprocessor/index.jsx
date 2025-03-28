// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useInitData } from '@lynx-js/react';

function App() {
  const initData = useInitData();
  return (
    <view
      id='target'
      style={{
        height: '100px',
        width: '100px',
        background: initData.bgColor ?? 'pink',
      }}
    />
  );
}

root.registerDataProcessors(
  class {
    static defaultDataProcessor(rawData) {
      if (rawData.mockData === 'mockData') {
        return {
          bgColor: 'green',
        };
      }
    }
  },
);

root.render(<App></App>);
