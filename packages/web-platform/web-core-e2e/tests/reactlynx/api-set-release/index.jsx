// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

function App() {
  if (__MAIN_THREAD__) {
    _SetSourceMapRelease({ release: '1' });
  }
  throw new Error('error');
}

root.render(<App></App>);
