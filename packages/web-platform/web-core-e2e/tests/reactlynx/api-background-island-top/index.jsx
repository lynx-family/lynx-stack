// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Background, root } from '@lynx-js/react';

import { Real } from './Real.jsx';
import { Skeleton } from './Skeleton.jsx';

// A boundary at the render root: the whole first screen is the fallback.
root.render(
  <page>
    <Background fallback={<Skeleton label='top' color='#c9d5e3' />}>
      <Real label='top' color='#2f6fd0' />
    </Background>
  </page>,
);
