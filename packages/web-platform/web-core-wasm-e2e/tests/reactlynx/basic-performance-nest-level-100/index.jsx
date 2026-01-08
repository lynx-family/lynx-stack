// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

function App(prop) {
  return (
    <div
      id={`target-${prop.count}`}
    >
      {prop.count && <App count={prop.count - 1} />}
    </div>
  );
}

root.render(<App count={100}></App>);
