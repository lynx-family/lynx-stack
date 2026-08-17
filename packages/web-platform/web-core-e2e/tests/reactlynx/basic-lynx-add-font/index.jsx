// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';
function App() {
  const [loaded, setLoaded] = useState(false);
  return (
    <text
      id='target'
      bindTap={() => {
        lynx.addFont(
          {
            'font-family': 'Add Font E2E',
            'src': 'url("../../../resources/PressStart2P-Regular.ttf")',
          },
          () => {
            setLoaded(true);
          },
        );
      }}
      style={{
        fontFamily: loaded ? 'Add Font E2E' : 'initial',
      }}
    >
      hello
    </text>
  );
}
root.render(<App />);
