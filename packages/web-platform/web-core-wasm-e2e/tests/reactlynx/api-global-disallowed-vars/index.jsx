// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  if (__MAIN_THREAD__) {
    console.log(
      `main thread: ${navigator}, ${postMessage}`,
    );
  } else {
    console.log(
      `background thread: ${navigator}, ${postMessage}`,
    );
  }

  return <view />;
}
root.render(
  <page>
    <App></App>
  </page>,
);
