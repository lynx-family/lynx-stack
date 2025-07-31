// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback, useMainThreadRef } from '@lynx-js/react';

function Foo(props) {
  const { mainThreadSetRef } = props;

  function setRef(element) {
    'main thread';
    mainThreadSetRef(element);

    element?.setStyleProperties({
      'background-color': 'rgb(0, 128, 0)',
      'height': '200px',
      'width': '200px',
    });
  }

  return (
    <view
      main-thread:ref={setRef}
      id='target'
    />
  );
}

export function App() {
  const ref = useMainThreadRef([]);

  const setRef = useCallback(function setRef(element) {
    'main thread';

    ref.current[0] = element;
  }, []);

  return (
    <view main-thread:ref={setRef}>
      <Foo mainThreadSetRef={setRef} />
    </view>
  );
}
root.render(<App />);
