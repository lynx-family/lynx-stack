// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

const markdownStyle = {
  link: {
    color: '00ff00',
  },
};

function App() {
  return (
    <view>
      <x-markdown
        id='markdown'
        content={'[link](https://example.com)'}
        markdown-style={markdownStyle}
      />
    </view>
  );
}

root.render(<App />);
