// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

import { Section } from './Section.jsx';

// The entry itself has no `<Background>`: the boundary is one import away.
root.render(
  <page>
    <Section />
  </page>,
);
