// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';

function Page() {
  const [appearTriggered, setAppearTriggered] = useState(false);
  const [uidisappearTriggered, setUidisappearTriggered] = useState(false);

  return (
    <scroll-view style={{ height: '500px', width: '300px' }}>
      <view
        id='control'
        style={{
          width: '100%',
          height: '550px',
          background: appearTriggered ? 'green' : 'red',
        }}
        binduiappear={() => {
          setAppearTriggered(true);
        }}
      >
      </view>
      <view
        id='target'
        style={{
          width: '100%',
          height: '50px',
          background: uidisappearTriggered ? 'red' : 'green',
        }}
        binduidisappear={() => {
          setUidisappearTriggered(true);
        }}
        binduiappear={() => {
          setUidisappearTriggered(true);
        }}
      />
    </scroll-view>
  );
}
root.render(<Page />);
