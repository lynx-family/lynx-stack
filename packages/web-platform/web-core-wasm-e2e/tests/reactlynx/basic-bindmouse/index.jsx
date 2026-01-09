// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root, runOnBackground } from '@lynx-js/react';
function App() {
  const [hasMouseDown, setHasMouseDown] = useState(false);
  const [hasMouseUp, setHasMouseUp] = useState(false);
  const [hasMouseMove, setHasMouseMove] = useState(false);
  const handleMouseDown = (e) => {
    if (
      e.type === 'mousedown' && 'button' in e && 'buttons' in e && 'x' in e
      && 'y' in e && 'pageX' in e && 'pageY' in e && 'clientX' in e
      && 'clientY' in e
    ) {
      setHasMouseDown(true);
    }
  };
  const handleMouseUp = (e) => {
    if (
      e.type === 'mouseup' && 'button' in e && 'buttons' in e && 'x' in e
      && 'y' in e && 'pageX' in e && 'pageY' in e && 'clientX' in e
      && 'clientY' in e
    ) {
      setHasMouseUp(true);
    }
  };
  const handleMouseMove = (e) => {
    if (
      e.type === 'mousemove' && 'button' in e && 'buttons' in e && 'x' in e
      && 'y' in e && 'pageX' in e && 'pageY' in e && 'clientX' in e
      && 'clientY' in e
    ) {
      setHasMouseMove(true);
    }
  };

  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      <view
        id='target'
        class='container'
        style={{ width: '100px', height: '100px', backgroundColor: 'red' }}
        bindmousedown={handleMouseDown}
        bindmouseup={handleMouseUp}
        bindmousemove={handleMouseMove}
      />
      <view
        id='target1'
        style={{
          height: '100px',
          width: '100px',
          background: hasMouseDown ? 'green' : 'pink',
        }}
      />
      <view
        id='target2'
        style={{
          height: '100px',
          width: '100px',
          background: hasMouseUp ? 'green' : 'pink',
        }}
      />
      <view
        id='target3'
        style={{
          height: '100px',
          width: '100px',
          background: hasMouseMove ? 'green' : 'pink',
        }}
      />
    </view>
  );
}
root.render(<App />);
