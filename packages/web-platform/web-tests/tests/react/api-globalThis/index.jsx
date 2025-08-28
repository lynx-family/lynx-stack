// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, runOnMainThread, useEffect } from '@lynx-js/react';
globalThis.foo = 123;
function App() {
  function mtsFoo() {
    'main thread';
    console.log('mtsFoo', foo);
  }
  useEffect(() => {
    runOnMainThread(mtsFoo)();
    console.log('btsFoo', foo);
  });

  return <view />;
}
root.render(
  <page>
    <App></App>
  </page>,
);
